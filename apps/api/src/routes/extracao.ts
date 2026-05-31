import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import {
  buildExtracoesDTO,
  rejectExtracao,
  runExtractionForProject,
  validateExtracao,
} from "../extraction/engine.js";

const validateSchema = z.object({
  fields: z
    .array(
      z.object({
        section: z.string().min(1),
        key: z.string().min(1),
        value: z.unknown().optional(),
        accept: z.boolean(),
      }),
    )
    .default([]),
});

/**
 * Motor de Extração de Dados (TRNSF-952) — fila de validação e confirmação.
 * Os dados extraídos dos documentos arquivados entram aqui por validar e, ao
 * confirmar, preenchem a candidatura (origem='extraido').
 */
export async function extracaoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Estado do separador Extração (fila + processadas + conflitos)
  app.get<{ Params: { id: string } }>("/api/projects/:id/extracoes", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
    return buildExtracoesDTO(project.id);
  });

  // (Re)correr a extração de todos os documentos arquivados do projecto
  app.post<{ Params: { id: string } }>("/api/projects/:id/extracoes/run", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
    const cand = await prisma.candidatura.findUnique({ where: { projectId: project.id } });
    if (!cand) return reply.code(409).send({ error: "Inicie a candidatura antes de extrair dados." });
    try {
      const result = await runExtractionForProject(project.id);
      return { ok: true, ...result };
    } catch (e) {
      app.log.error({ err: e }, "Falha ao correr extração do projecto");
      return reply.code(500).send({ error: "Falha ao correr a extração." });
    }
  });

  // Confirmar uma extração → escreve os campos aceites na candidatura
  app.post<{ Params: { eid: string } }>("/api/extracoes/:eid/validate", async (req, reply) => {
    const parsed = validateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try {
      await validateExtracao(req.params.eid, parsed.data.fields, req.user!.id);
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const map: Record<string, [number, string]> = {
        EXTRACAO_NOT_FOUND: [404, "Extração não encontrada."],
        EXTRACAO_NOT_PENDING: [409, "Extração já foi processada."],
      };
      const [code, message] = map[msg] ?? [500, "Falha ao validar a extração."];
      if (code >= 500) app.log.error({ err: e }, "Falha ao validar extração");
      return reply.code(code).send({ error: message });
    }
  });

  // Descartar uma extração da fila
  app.post<{ Params: { eid: string } }>("/api/extracoes/:eid/reject", async (req, reply) => {
    try {
      await rejectExtracao(req.params.eid, req.user!.id);
      return { ok: true };
    } catch {
      return reply.code(404).send({ error: "Extração não encontrada." });
    }
  });
}
