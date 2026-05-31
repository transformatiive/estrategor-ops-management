import {
  DOCUMENT_TAXONOMY,
  buildDocumentFilename,
  confidenceBand,
  resolveTargetFolderPath,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { getWorkDrive } from "../workdrive/adapter.js";
import { provisionProjectFolders } from "../workdrive/provision.js";
import { classifyDocument } from "./classifier.js";
import { countPages, extractPages } from "./pdf.js";
import { cancelPendingReminders } from "../seguimento/service.js";
import { runExtractionForDocument } from "../extraction/engine.js";

function extOf(name: string): string | undefined {
  return name.includes(".") ? name.split(".").pop() : undefined;
}

/** Garante o item de checklist para um tipo de documento do projecto. */
async function ensureChecklistItem(projectId: string, documentTypeId: string) {
  return prisma.checklistItem.upsert({
    where: { projectId_documentTypeId: { projectId, documentTypeId } },
    update: {},
    create: { projectId, documentTypeId, status: "EM_FALTA" },
  });
}

export interface IngestInput {
  projectId: string;
  originalFilename: string;
  content: Buffer;
  mimeType: string;
  origin: "CLIENTE" | "MANUAL";
  collectionLinkId?: string | null;
  /** tipos candidatos (ex.: o que o cliente escolheu na recolha) */
  candidateKeys?: string[];
}

export interface IngestResult {
  documentId: string;
  multiDocument: boolean;
  partsCreated: number;
  status: string;
}

/**
 * Recebe um ficheiro (recolha §D ou manual), carrega-o em staging (pasta-raiz do
 * projecto), classifica com IA, divide fisicamente se for multi-documento e
 * coloca tudo na FILA DE VALIDAÇÃO (status a_validar). Nada é arquivado na pasta
 * definitiva sem confirmação humana (TRNSF-938).
 */
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { client: true, program: true },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  await provisionProjectFolders(project.id);
  const folders = await prisma.folder.findMany({ where: { projectId: project.id } });
  const root = folders.find((f) => f.isRoot);
  if (!root?.workdriveId) throw new Error("FOLDER_NOT_READY");

  const wd = getWorkDrive();
  // 1) original para staging (pasta-raiz)
  const uploaded = await wd.uploadFile(
    root.workdriveId,
    input.originalFilename,
    input.content,
    input.mimeType,
  );
  const pageCount = await countPages(input.content, input.mimeType);

  // 2) classificação por IA
  const result = await classifyDocument({
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    content: input.content,
    pageCount,
    candidateKeys: input.candidateKeys,
  });

  const original = await prisma.document.create({
    data: {
      projectId: project.id,
      collectionLinkId: input.collectionLinkId ?? null,
      originalFilename: input.originalFilename,
      workdriveFileId: uploaded.workdriveId,
      workdriveUrl: uploaded.workdriveUrl,
      mimeType: input.mimeType,
      sizeBytes: input.content.length,
      origin: input.origin,
      status: "em_analise",
    },
  });

  // 3) multi-documento → divisão física, um Documento por parte
  if (result.multiDocument && result.parts && result.parts.length > 1 && input.mimeType === "application/pdf") {
    let created = 0;
    for (const part of result.parts) {
      const partType = await prisma.documentType.findUnique({ where: { key: part.typeKey } });
      const partBuffer = await extractPages(input.content, part.startPage, part.endPage);
      const partName = `${input.originalFilename.replace(/\.pdf$/i, "")}_p${part.startPage}-${part.endPage}.pdf`;
      const up = await wd.uploadFile(root.workdriveId, partName, partBuffer, "application/pdf");
      await prisma.document.create({
        data: {
          projectId: project.id,
          parentDocumentId: original.id,
          collectionLinkId: input.collectionLinkId ?? null,
          proposedTypeId: partType?.id ?? null,
          originalFilename: partName,
          workdriveFileId: up.workdriveId,
          workdriveUrl: up.workdriveUrl,
          mimeType: "application/pdf",
          sizeBytes: partBuffer.length,
          pageStart: part.startPage,
          pageEnd: part.endPage,
          origin: input.origin,
          confidence: confidenceBand(result.confidence),
          confidenceScore: result.confidence,
          status: "a_validar",
        },
      });
      created += 1;
    }
    await prisma.document.update({ where: { id: original.id }, data: { status: "dividido" } });
    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        type: "doc_split",
        description: `Ficheiro "${input.originalFilename}" dividido em ${created} documento(s) (IA, ${wd.mode}).`,
      },
    });
    return { documentId: original.id, multiDocument: true, partsCreated: created, status: "dividido" };
  }

  // 4) documento único → proposta + fila de validação
  const proposedType = result.proposedTypeKey
    ? await prisma.documentType.findUnique({ where: { key: result.proposedTypeKey } })
    : null;
  await prisma.document.update({
    where: { id: original.id },
    data: {
      proposedTypeId: proposedType?.id ?? null,
      confidence: confidenceBand(result.confidence),
      confidenceScore: result.confidence,
      status: "a_validar",
    },
  });
  await prisma.activityLog.create({
    data: {
      projectId: project.id,
      type: "doc_classified",
      description: `"${input.originalFilename}" classificado como ${proposedType?.name ?? "—"} (conf. ${(result.confidence * 100).toFixed(0)}%, ${wd.mode}).`,
    },
  });
  return { documentId: original.id, multiDocument: false, partsCreated: 0, status: "a_validar" };
}

/**
 * Confirma a classificação de um documento e arquiva-o na pasta WorkDrive correcta
 * com o nome §11 (TRNSF-938). Só aqui o documento é arquivado e o item de
 * checklist passa a RECEBIDO.
 */
export async function validateDocument(
  documentId: string,
  documentTypeKey: string,
  userId: string,
): Promise<void> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { include: { client: true, program: true } } },
  });
  if (!doc) throw new Error("DOC_NOT_FOUND");
  if (doc.status !== "a_validar") throw new Error("DOC_NOT_PENDING");

  const docTypeDef = DOCUMENT_TAXONOMY.find((d) => d.key === documentTypeKey);
  const docType = await prisma.documentType.findUnique({ where: { key: documentTypeKey } });
  if (!docTypeDef || !docType) throw new Error("TYPE_UNKNOWN");

  const project = doc.project;
  const folders = await prisma.folder.findMany({ where: { projectId: project.id } });
  const targetPath = resolveTargetFolderPath(docTypeDef.targetFolder, folders.map((f) => f.path));
  const targetFolder = folders.find((f) => f.path === targetPath) ?? folders.find((f) => f.isRoot);
  if (!targetFolder?.workdriveId) throw new Error("FOLDER_NOT_READY");

  const storedFilename = buildDocumentFilename({
    clientName: project.client.name,
    programCode: project.program.code,
    documentTypeKey,
    extension: extOf(doc.originalFilename),
  });

  const wd = getWorkDrive();
  const moved = doc.workdriveFileId
    ? await wd.moveFile(doc.workdriveFileId, targetFolder.workdriveId, storedFilename)
    : { workdriveId: null, workdriveUrl: null };

  const checklistItem = await ensureChecklistItem(project.id, docType.id);

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      documentTypeId: docType.id,
      checklistItemId: checklistItem.id,
      storedFilename,
      workdriveFileId: moved.workdriveId,
      workdriveUrl: moved.workdriveUrl,
      confidence: "ALTA",
      status: "arquivado",
      validatedById: userId,
      validatedAt: new Date(),
    },
  });

  await prisma.checklistItem.update({
    where: { id: checklistItem.id },
    data: { status: "RECEBIDO" },
  });

  await prisma.activityLog.create({
    data: {
      projectId: project.id,
      userId,
      type: "doc_archived",
      description: `Documento validado e arquivado: ${storedFilename} (${docTypeDef.name}).`,
    },
  });

  // fecha o pedido de recolha se já não falta nada do que foi pedido
  if (doc.collectionLinkId) {
    const link = await prisma.collectionLink.findUnique({ where: { id: doc.collectionLinkId } });
    if (link) {
      const reqTypeIds = await prisma.documentType.findMany({
        where: { key: { in: link.requestedKeys } },
        select: { id: true },
      });
      const pending = await prisma.checklistItem.count({
        where: {
          projectId: project.id,
          documentTypeId: { in: reqTypeIds.map((t) => t.id) },
          status: "EM_FALTA",
        },
      });
      if (pending === 0) {
        await prisma.collectionLink.update({
          where: { id: link.id },
          data: { status: "USADO", usedAt: new Date() },
        });
        // recolha completa → cancela lembretes pendentes (§9 / TRNSF-939)
        await cancelPendingReminders(link.id);
      }
    }
  }

  // TRNSF-952 — assim que o documento é arquivado, se houver candidatura e o tipo
  // tiver extractor, dispara a extração de dados (determinístico → fallback IA).
  // Best-effort: nunca bloqueia o arquivo do documento.
  try {
    await runExtractionForDocument(doc.id);
  } catch (e) {
    console.warn(`[extracao] falha ao extrair do documento ${doc.id}:`, e instanceof Error ? e.message : e);
  }
}

/** Rejeita um documento da fila (não arquiva). */
export async function rejectDocument(documentId: string, userId: string): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("DOC_NOT_FOUND");
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "rejeitado", validatedById: userId, validatedAt: new Date() },
  });
  await prisma.activityLog.create({
    data: {
      projectId: doc.projectId,
      userId,
      type: "doc_rejected",
      description: `Documento rejeitado: ${doc.originalFilename}.`,
    },
  });
}
