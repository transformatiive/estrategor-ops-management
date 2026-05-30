import { randomBytes } from "node:crypto";
import { DOCUMENT_TAXONOMY } from "@estrategor/shared";
import { prisma } from "../db.js";
import { ingestDocument } from "../ai/pipeline.js";

/** Gera um token opaco para a ligação de recolha. */
export function generateToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Recebe um ficheiro entregue pelo cliente via link de recolha (TRNSF-937):
 * valida o token e o tipo pedido, e encaminha para o pipeline de classificação
 * (TRNSF-938) — o ficheiro fica na fila de validação (não é arquivado sem
 * confirmação humana). O tipo escolhido pelo cliente é candidato à classificação.
 */
export async function ingestClientUpload(opts: {
  token: string;
  documentTypeKey: string;
  originalFilename: string;
  content: Buffer;
  mimeType: string;
}): Promise<{ documentId: string; status: string }> {
  const link = await prisma.collectionLink.findUnique({ where: { token: opts.token } });
  if (!link) throw new Error("LINK_NOT_FOUND");
  if (link.status === "EXPIRADO" || link.expiresAt < new Date()) {
    if (link.status !== "EXPIRADO") {
      await prisma.collectionLink.update({ where: { id: link.id }, data: { status: "EXPIRADO" } });
    }
    throw new Error("LINK_EXPIRED");
  }
  if (!link.requestedKeys.includes(opts.documentTypeKey)) {
    throw new Error("TYPE_NOT_REQUESTED");
  }
  if (!DOCUMENT_TAXONOMY.some((d) => d.key === opts.documentTypeKey)) {
    throw new Error("TYPE_UNKNOWN");
  }

  const result = await ingestDocument({
    projectId: link.projectId,
    originalFilename: opts.originalFilename,
    content: opts.content,
    mimeType: opts.mimeType,
    origin: "CLIENTE",
    collectionLinkId: link.id,
    candidateKeys: [opts.documentTypeKey],
  });

  return { documentId: result.documentId, status: result.status };
}
