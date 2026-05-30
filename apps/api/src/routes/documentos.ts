import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  DOCUMENT_TAXONOMY,
  type DocumentDTO,
  type DocumentStatus,
  type ProjectDocumentsDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireAuth } from "../auth/guards.js";
import { getWorkDrive } from "../workdrive/adapter.js";
import { ingestDocument, validateDocument, rejectDocument } from "../ai/pipeline.js";

const validateSchema = z.object({
  documentTypeKey: z.string().min(1),
});

type DocWithTypes = {
  id: string;
  status: string;
  originalFilename: string;
  storedFilename: string | null;
  origin: "CLIENTE" | "MANUAL";
  documentType: { key: string; name: string } | null;
  proposedType: { key: string; name: string } | null;
  confidence: "ALTA" | "BAIXA";
  confidenceScore: number | null;
  pageStart: number | null;
  pageEnd: number | null;
  parentDocumentId: string | null;
  workdriveUrl: string | null;
  validatedBy: { fullName: string } | null;
  validatedAt: Date | null;
  createdAt: Date;
};

function toDTO(d: DocWithTypes): DocumentDTO {
  return {
    id: d.id,
    status: d.status as DocumentStatus,
    originalFilename: d.originalFilename,
    storedFilename: d.storedFilename,
    origin: d.origin,
    documentTypeKey: d.documentType?.key ?? null,
    documentTypeName: d.documentType?.name ?? null,
    proposedTypeKey: d.proposedType?.key ?? null,
    proposedTypeName: d.proposedType?.name ?? null,
    confidence: d.confidence,
    confidenceScore: d.confidenceScore,
    pageStart: d.pageStart,
    pageEnd: d.pageEnd,
    parentDocumentId: d.parentDocumentId,
    workdriveUrl: d.workdriveUrl,
    validatedBy: d.validatedBy?.fullName ?? null,
    validatedAt: d.validatedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}

export async function documentosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // E — fila de validação + arquivados do projecto (separador Documentos)
  app.get<{ Params: { id: string } }>("/api/projects/:id/documents", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });

    const docs = await prisma.document.findMany({
      where: { projectId: req.params.id },
      include: { documentType: true, proposedType: true, validatedBy: true },
      orderBy: [{ confidence: "asc" }, { createdAt: "desc" }], // baixa confiança ao topo
    });
    const dtos = docs.map((d) => toDTO(d as unknown as DocWithTypes));
    const dto: ProjectDocumentsDTO = {
      queue: dtos.filter((d) => d.status === "a_validar"),
      archived: dtos.filter((d) => d.status === "arquivado"),
    };
    return dto;
  });

  // E — pré-visualizar o ficheiro de um documento (inline) antes de validar
  app.get<{ Params: { docId: string } }>("/api/documents/:docId/file", async (req, reply) => {
    const doc = await prisma.document.findUnique({ where: { id: req.params.docId } });
    if (!doc) return reply.code(404).send({ error: "Documento não encontrado." });
    if (!doc.workdriveFileId) return reply.code(404).send({ error: "Ficheiro indisponível." });
    try {
      const content = await getWorkDrive().downloadFile(doc.workdriveFileId);
      reply.header("Content-Type", doc.mimeType ?? "application/octet-stream");
      // inline para abrir no browser (PDF/imagem); nome legível para download
      reply.header(
        "Content-Disposition",
        `inline; filename="${(doc.storedFilename ?? doc.originalFilename).replace(/"/g, "")}"`,
      );
      return reply.send(content);
    } catch (e) {
      app.log.error({ err: e }, "Falha ao obter ficheiro do documento");
      return reply.code(502).send({ error: "Não foi possível obter o ficheiro." });
    }
  });

  // E — upload manual de um documento (entra no pipeline de classificação)
  app.post<{ Params: { id: string } }>("/api/projects/:id/documents", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Nenhum ficheiro enviado." });
    const content = await file.toBuffer();
    if (content.length > env.UPLOAD_MAX_BYTES) {
      return reply.code(413).send({ error: "Ficheiro demasiado grande." });
    }
    try {
      const result = await ingestDocument({
        projectId: project.id,
        originalFilename: file.filename,
        content,
        mimeType: file.mimetype,
        origin: "MANUAL",
      });
      return reply.code(201).send({ ok: true, ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "FOLDER_NOT_READY") {
        return reply.code(502).send({ error: "Pasta do WorkDrive indisponível." });
      }
      app.log.error({ err: e }, "Falha no upload manual");
      return reply.code(500).send({ error: "Falha ao processar o ficheiro." });
    }
  });

  // E-06 — validar (confirmar/corrigir tipo) → arquiva na pasta correcta
  app.post<{ Params: { docId: string } }>(
    "/api/documents/:docId/validate",
    async (req, reply) => {
      const parsed = validateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "documentTypeKey em falta." });
      }
      if (!DOCUMENT_TAXONOMY.some((d) => d.key === parsed.data.documentTypeKey)) {
        return reply.code(400).send({ error: "Tipo de documento desconhecido." });
      }
      try {
        await validateDocument(req.params.docId, parsed.data.documentTypeKey, req.user!.id);
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const map: Record<string, [number, string]> = {
          DOC_NOT_FOUND: [404, "Documento não encontrado."],
          DOC_NOT_PENDING: [409, "Documento já não está na fila de validação."],
          TYPE_UNKNOWN: [400, "Tipo de documento desconhecido."],
          FOLDER_NOT_READY: [502, "Pasta do WorkDrive indisponível."],
        };
        const [code, message] = map[msg] ?? [500, "Falha ao validar."];
        if (code >= 500) app.log.error({ err: e }, "Falha ao validar documento");
        return reply.code(code).send({ error: message });
      }
    },
  );

  // E — rejeitar um documento da fila
  app.post<{ Params: { docId: string } }>(
    "/api/documents/:docId/reject",
    async (req, reply) => {
      try {
        await rejectDocument(req.params.docId, req.user!.id);
        return { ok: true };
      } catch {
        return reply.code(404).send({ error: "Documento não encontrado." });
      }
    },
  );
}
