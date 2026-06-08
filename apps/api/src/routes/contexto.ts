import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CAND_CONTEXT_KINDS,
  type CandContextKind,
  type CandContextSourceDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { getWorkDrive } from "../workdrive/adapter.js";
import { extractPdfText, looksLikePdf } from "../ai/pdf.js";
import { looksLikeXlsx, readSheets, type SheetData } from "../extraction/xlsx.js";

/** Texto máximo guardado por fonte-documento (o teto de injeção é no shared). */
const MAX_DOC_TEXT = 14000;
const MAX_TEXT = 20000;
const PREVIEW = 280;

function sheetsToText(sheets: SheetData[]): string {
  return sheets
    .map((s) => {
      const linhas = s.rows
        .map((r) => r.map((c) => (c == null ? "" : String(c))).join(" | "))
        .filter((l) => l.trim().length > 0)
        .join("\n");
      return `# ${s.name}\n${linhas}`;
    })
    .join("\n\n");
}

/** Extrai texto legível de um documento arquivado (PDF, Excel ou texto). */
async function documentToText(documentId: string): Promise<{ text: string; label: string } | null> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return null;
  const label = doc.originalFilename ?? doc.storedFilename ?? "Documento";
  const blob = await prisma.documentBlob.findUnique({ where: { documentId } });
  const raw = blob?.bytes ?? (doc.workdriveFileId ? await getWorkDrive().downloadFile(doc.workdriveFileId) : null);
  if (!raw) return { text: "", label };
  const buf = Buffer.from(raw);
  let text = "";
  if (looksLikePdf(buf)) {
    text = await extractPdfText(buf, MAX_DOC_TEXT);
  } else if (looksLikeXlsx(buf, doc.mimeType ?? "")) {
    const sheets = await readSheets(buf);
    text = sheets ? sheetsToText(sheets).slice(0, MAX_DOC_TEXT) : "";
  } else {
    text = buf.toString("utf8").slice(0, MAX_DOC_TEXT);
  }
  return { text: text.trim(), label };
}

function toDTO(s: {
  id: string;
  kind: string;
  label: string;
  content: string;
  documentId: string | null;
  createdAt: Date;
}): CandContextSourceDTO {
  return {
    id: s.id,
    kind: s.kind as CandContextKind,
    label: s.label,
    preview: s.content.slice(0, PREVIEW),
    chars: s.content.length,
    documentId: s.documentId,
    createdAt: s.createdAt.toISOString(),
  };
}

/**
 * Fontes de contexto da Preparação (TRNSF-1068 · item 1): texto colado
 * (emails, descrição) e documentos descritivos (candidaturas anteriores,
 * memória, mapas) que alimentam a geração da candidatura.
 */
export async function contextoRoutes(app: FastifyInstance): Promise<void> {
  // Listar as fontes de uma candidatura.
  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/contexto", async (req, reply) => {
    const cand = await prisma.candidatura.findUnique({ where: { projectId: req.params.id } });
    if (!cand) return reply.code(404).send({ error: "Candidatura não encontrada." });
    const sources = await prisma.candContextSource.findMany({
      where: { candidaturaId: cand.id },
      orderBy: { createdAt: "asc" },
    });
    return { sources: sources.map(toDTO) };
  });

  // Acrescentar uma fonte (texto/email/precedente colado, ou documento do projeto).
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/api/projects/:id/candidatura/contexto",
    async (req, reply) => {
      const cand = await prisma.candidatura.findUnique({ where: { projectId: req.params.id } });
      if (!cand) return reply.code(404).send({ error: "Candidatura não encontrada." });

      const parsed = z
        .object({
          kind: z.enum(CAND_CONTEXT_KINDS),
          label: z.string().trim().max(160).optional(),
          content: z.string().max(MAX_TEXT).optional(),
          documentId: z.string().optional(),
        })
        .safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
      const { kind } = parsed.data;

      let label = parsed.data.label ?? "";
      let content = (parsed.data.content ?? "").trim();
      let documentId: string | null = null;

      if (kind === "documento") {
        if (!parsed.data.documentId) {
          return reply.code(400).send({ error: "Indique o documento a usar como contexto." });
        }
        const doc = await prisma.document.findUnique({ where: { id: parsed.data.documentId } });
        if (!doc || doc.projectId !== req.params.id) {
          return reply.code(404).send({ error: "Documento não encontrado neste projeto." });
        }
        const extracted = await documentToText(parsed.data.documentId);
        if (!extracted || !extracted.text) {
          return reply.code(422).send({ error: "Não foi possível extrair texto deste documento." });
        }
        documentId = parsed.data.documentId;
        content = extracted.text;
        label = label || extracted.label;
      } else {
        if (!content) return reply.code(400).send({ error: "Cole o texto a usar como contexto." });
        label = label || (kind === "email" ? "Email" : "Texto");
      }

      const created = await prisma.candContextSource.create({
        data: { candidaturaId: cand.id, kind, label, content, documentId, createdById: req.user!.id },
      });
      await prisma.activityLog.create({
        data: {
          projectId: req.params.id,
          userId: req.user!.id,
          type: "contexto_fonte",
          description: `Fonte de contexto adicionada à candidatura (${label}).`,
        },
      });
      return reply.code(201).send(toDTO(created));
    },
  );

  // Remover uma fonte.
  app.delete<{ Params: { id: string; sourceId: string } }>(
    "/api/projects/:id/candidatura/contexto/:sourceId",
    async (req, reply) => {
      const cand = await prisma.candidatura.findUnique({ where: { projectId: req.params.id } });
      if (!cand) return reply.code(404).send({ error: "Candidatura não encontrada." });
      const src = await prisma.candContextSource.findUnique({ where: { id: req.params.sourceId } });
      if (!src || src.candidaturaId !== cand.id) {
        return reply.code(404).send({ error: "Fonte não encontrada." });
      }
      await prisma.candContextSource.delete({ where: { id: req.params.sourceId } });
      return { ok: true };
    },
  );
}
