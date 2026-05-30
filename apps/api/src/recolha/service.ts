import { randomBytes } from "node:crypto";
import {
  DOCUMENT_TAXONOMY,
  buildDocumentFilename,
  resolveTargetFolderPath,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { getWorkDrive } from "../workdrive/adapter.js";
import { provisionProjectFolders } from "../workdrive/provision.js";

/** Gera um token opaco para a ligação de recolha. */
export function generateToken(): string {
  return randomBytes(24).toString("hex");
}

/** Garante que o item de checklist existe para um tipo de documento do projecto. */
async function ensureChecklistItem(projectId: string, documentTypeId: string) {
  return prisma.checklistItem.upsert({
    where: { projectId_documentTypeId: { projectId, documentTypeId } },
    update: {},
    create: { projectId, documentTypeId, status: "EM_FALTA" },
  });
}

/**
 * Recebe um ficheiro entregue pelo cliente via link de recolha (TRNSF-937):
 * - valida o token e o tipo de documento;
 * - garante as pastas do projecto;
 * - carrega o ficheiro para a subpasta WorkDrive correcta com o nome §11;
 * - cria o Documento (origem CLIENTE) e marca o item de checklist como RECEBIDO.
 */
export async function ingestClientUpload(opts: {
  token: string;
  documentTypeKey: string;
  originalFilename: string;
  content: Buffer;
  mimeType: string;
}): Promise<{ documentId: string; storedFilename: string }> {
  const link = await prisma.collectionLink.findUnique({
    where: { token: opts.token },
    include: { project: { include: { client: true, program: true } } },
  });
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

  const docTypeDef = DOCUMENT_TAXONOMY.find((d) => d.key === opts.documentTypeKey);
  if (!docTypeDef) throw new Error("TYPE_UNKNOWN");
  const docType = await prisma.documentType.findUnique({ where: { key: opts.documentTypeKey } });
  if (!docType) throw new Error("TYPE_UNKNOWN");

  const project = link.project;

  // garante as pastas (idempotente) e resolve a subpasta-alvo
  await provisionProjectFolders(project.id);
  const folders = await prisma.folder.findMany({ where: { projectId: project.id } });
  const targetPath = resolveTargetFolderPath(
    docTypeDef.targetFolder,
    folders.map((f) => f.path),
  );
  const targetFolder =
    folders.find((f) => f.path === targetPath) ?? folders.find((f) => f.isRoot);
  if (!targetFolder?.workdriveId) throw new Error("FOLDER_NOT_READY");

  // nome do ficheiro conforme §11
  const ext = opts.originalFilename.includes(".")
    ? opts.originalFilename.split(".").pop()
    : undefined;
  const storedFilename = buildDocumentFilename({
    clientName: project.client.name,
    programCode: project.program.code,
    documentTypeKey: opts.documentTypeKey,
    extension: ext,
  });

  const wd = getWorkDrive();
  const uploaded = await wd.uploadFile(
    targetFolder.workdriveId,
    storedFilename,
    opts.content,
    opts.mimeType,
  );

  const checklistItem = await ensureChecklistItem(project.id, docType.id);

  const document = await prisma.document.create({
    data: {
      projectId: project.id,
      checklistItemId: checklistItem.id,
      documentTypeId: docType.id,
      collectionLinkId: link.id,
      originalFilename: opts.originalFilename,
      storedFilename,
      workdriveFileId: uploaded.workdriveId,
      workdriveUrl: uploaded.workdriveUrl,
      mimeType: opts.mimeType,
      sizeBytes: opts.content.length,
      origin: "CLIENTE",
      status: "recebido",
    },
  });

  // marca o item como RECEBIDO (cruzamento com a checklist — §F base)
  await prisma.checklistItem.update({
    where: { id: checklistItem.id },
    data: { status: "RECEBIDO" },
  });

  // regista a entrega (a notificação por email real entra no TRNSF-939)
  await prisma.activityLog.create({
    data: {
      projectId: project.id,
      type: "client_upload",
      description: `Cliente entregou "${docTypeDef.name}" (${storedFilename}).`,
    },
  });

  // se já não falta nenhum item pedido, marca o link como USADO
  const requestedTypeIds = await prisma.documentType.findMany({
    where: { key: { in: link.requestedKeys } },
    select: { id: true },
  });
  const pending = await prisma.checklistItem.count({
    where: {
      projectId: project.id,
      documentTypeId: { in: requestedTypeIds.map((t) => t.id) },
      status: "EM_FALTA",
    },
  });
  if (pending === 0) {
    await prisma.collectionLink.update({
      where: { id: link.id },
      data: { status: "USADO", usedAt: new Date() },
    });
  }

  return { documentId: document.id, storedFilename };
}
