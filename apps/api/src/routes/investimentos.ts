import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import {
  addLinha,
  buildInvestimentosDTO,
  buildResumoExecutivo,
  deleteLinha,
  importLinhas,
  updateLinha,
} from "../investimentos/engine.js";
import { prisma } from "../db.js";
import { getWorkDrive } from "../workdrive/adapter.js";
import { looksLikeXlsx, readSheets } from "../extraction/xlsx.js";
import { parseMapaInvestimentos } from "../extraction/investimentosMapa.js";

const linhaSchema = z.object({
  designacao: z.string().min(1),
  categoria: z.string().min(1),
  atividade: z.string().nullable().optional(),
  estabelecimento: z.string().nullable().optional(),
  dataAquisicao: z.string().nullable().optional(),
  elegivel: z.number(),
  ef: z.boolean().optional(),
});

// Linha importada (categoria pode vir vazia do mapa — o consultor completa).
const linhaImportSchema = linhaSchema.extend({ categoria: z.string() });

/** Lê os bytes de um documento do projeto (BD ou WorkDrive). */
async function loadDocumentBytes(projectId: string, documentId: string): Promise<Buffer | null> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.projectId !== projectId) return null;
  const blob = await prisma.documentBlob.findUnique({ where: { documentId } });
  const raw = blob?.bytes ?? (doc.workdriveFileId ? await getWorkDrive().downloadFile(doc.workdriveFileId) : null);
  return raw ? Buffer.from(raw) : null;
}

/**
 * Custos / Investimentos + Resumo Executivo (TRNSF-945). Linhas de investimento
 * (origem='intake'), categorias do catálogo, totais e coerência com a
 * componente financeira (TRNSF-944).
 */
export async function investimentosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/investimentos", async (req, reply) => {
    const dto = await buildInvestimentosDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/investimentos", async (req, reply) => {
    const parsed = linhaSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try {
      await addLinha(req.params.id, parsed.data, req.user!.id);
      return buildInvestimentosDTO(req.params.id);
    } catch {
      return reply.code(404).send({ error: "Candidatura não iniciada." });
    }
  });

  app.patch<{ Params: { id: string; linhaId: string } }>(
    "/api/projects/:id/candidatura/investimentos/:linhaId",
    async (req, reply) => {
      const parsed = linhaSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
      try {
        await updateLinha(req.params.id, req.params.linhaId, parsed.data, req.user!.id);
        return buildInvestimentosDTO(req.params.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.code(msg === "LINHA_NOT_FOUND" ? 404 : 404).send({ error: msg === "LINHA_NOT_FOUND" ? "Linha não encontrada." : "Candidatura não iniciada." });
      }
    },
  );

  app.delete<{ Params: { id: string; linhaId: string } }>(
    "/api/projects/:id/candidatura/investimentos/:linhaId",
    async (req, reply) => {
      try {
        await deleteLinha(req.params.id, req.params.linhaId, req.user!.id);
        return buildInvestimentosDTO(req.params.id);
      } catch {
        return reply.code(404).send({ error: "Candidatura não iniciada." });
      }
    },
  );

  // ─── Importar o mapa de investimentos (Excel) — TRNSF-1070 ──────────────

  // Pré-visualização: lê o Excel e devolve as linhas detetadas (sem escrever).
  app.post<{ Params: { id: string }; Body: { documentId?: string } }>(
    "/api/projects/:id/candidatura/investimentos/importar/preview",
    async (req, reply) => {
      const documentId = (req.body ?? {}).documentId;
      if (!documentId) return reply.code(400).send({ error: "Indique o documento do mapa de investimentos." });
      const buf = await loadDocumentBytes(req.params.id, documentId);
      if (!buf) return reply.code(404).send({ error: "Documento não encontrado neste projeto." });
      if (!looksLikeXlsx(buf, "")) return reply.code(422).send({ error: "O documento não é um ficheiro Excel (.xlsx)." });
      const sheets = await readSheets(buf);
      if (!sheets) return reply.code(422).send({ error: "Não foi possível ler o ficheiro Excel." });
      return parseMapaInvestimentos(sheets);
    },
  );

  // Aplicar: acrescenta ou substitui as linhas (já revistas pelo consultor).
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/projects/:id/candidatura/investimentos/importar",
    async (req, reply) => {
      const parsed = z
        .object({ linhas: z.array(linhaImportSchema).min(1), modo: z.enum(["append", "replace"]) })
        .safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
      try {
        await importLinhas(req.params.id, parsed.data.linhas, parsed.data.modo, req.user!.id);
        return buildInvestimentosDTO(req.params.id);
      } catch {
        return reply.code(404).send({ error: "Candidatura não iniciada." });
      }
    },
  );

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/resumo", async (req, reply) => {
    const dto = await buildResumoExecutivo(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });
}
