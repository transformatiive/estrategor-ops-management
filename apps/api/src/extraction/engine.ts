import {
  EXTRACT_METHOD_LABELS,
  extractorFor,
  type ExtractaoConflictDTO,
  type ExtractaoDTO,
  type ExtractaoFieldDTO,
  type ExtractedField,
  type FieldState,
  type ProjectExtracoesDTO,
} from "@estrategor/shared";
import { DOCUMENT_TAXONOMY } from "@estrategor/shared";
import { prisma } from "../db.js";
import { getWorkDrive } from "../workdrive/adapter.js";
import { extractSnc } from "./snc.js";
import { extractMapaVendas, extractQuadroPessoal } from "./excel.js";
import { aiSpecFor, extractWithAi } from "./ai.js";
import type { ExtractInput, ExtractorOutput } from "./types.js";

const docTypeName = (key: string): string =>
  DOCUMENT_TAXONOMY.find((d) => d.key === key)?.name ?? key;

/** Despacha para o motor determinístico do tipo (ou null se não houver). */
function deterministicExtractor(tipo: string): ((i: ExtractInput) => Promise<ExtractorOutput>) | null {
  switch (tipo) {
    case "IES":
    case "MODELO_22":
      return extractSnc;
    case "MAPA_VENDAS":
      return extractMapaVendas;
    case "MAPAS_SEG_SOCIAL":
      return extractQuadroPessoal;
    default:
      return null;
  }
}

/**
 * Corre a extração para UM documento arquivado e grava o resultado na fila de
 * validação (estado por_validar). Regra de ouro: determinístico primeiro;
 * fallback para IA quando o determinístico não reconhece estrutura. Idempotente
 * por documento (re-correr substitui a extração anterior por validar).
 *
 * Devolve null (sem efeito) quando: o documento não tem tipo, o projecto não tem
 * candidatura, ou o tipo não tem extractor.
 */
export async function runExtractionForDocument(documentId: string): Promise<string | null> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { documentType: true, project: true },
  });
  if (!doc || !doc.documentType) return null;
  const tipo = doc.documentType.key;
  const target = extractorFor(tipo);
  if (!target) return null; // extractor inexistente — só arquiva

  const cand = await prisma.candidatura.findUnique({ where: { projectId: doc.projectId } });
  if (!cand) return null; // sem candidatura iniciada, não há onde escrever

  // não re-extrair uma extração já tratada pelo humano
  const prev = await prisma.extracao.findUnique({ where: { documentId } });
  if (prev && prev.estado !== "por_validar") return prev.id;

  if (!doc.workdriveFileId) return null;
  const content = await getWorkDrive().downloadFile(doc.workdriveFileId);
  const input: ExtractInput = {
    documentId,
    tipoDocumento: tipo,
    filename: doc.storedFilename ?? doc.originalFilename,
    mimeType: doc.mimeType ?? "application/octet-stream",
    content,
  };

  // 1) determinístico → 2) fallback IA (se existir spec de IA para o tipo)
  let out: ExtractorOutput;
  const det = deterministicExtractor(tipo);
  if (target.metodo === "deterministico" && det) {
    out = await det(input);
    if (out.campos.length === 0 && aiSpecFor(tipo)) {
      const aiOut = await extractWithAi(input);
      if (aiOut.campos.length > 0) out = aiOut;
    }
  } else {
    out = await extractWithAi(input);
  }

  const data = {
    candidaturaId: cand.id,
    tipoDocumento: tipo,
    metodo: out.metodo,
    confianca: out.confianca,
    camposExtraidos: out.campos as unknown as object,
    nota: out.nota,
    estado: "por_validar" as const,
  };
  const extracao = await prisma.extracao.upsert({
    where: { documentId },
    update: data,
    create: { documentId, ...data },
  });

  await prisma.activityLog.create({
    data: {
      projectId: doc.projectId,
      type: "extracao",
      description: `Extração de ${docTypeName(tipo)} (${EXTRACT_METHOD_LABELS[out.metodo]}): ${out.campos.length} campo(s)${out.nota ? ` — ${out.nota}` : ""}.`,
    },
  });
  return extracao.id;
}

/** Corre a extração para todos os documentos arquivados de um projecto. */
export async function runExtractionForProject(projectId: string): Promise<{ processados: number }> {
  const docs = await prisma.document.findMany({
    where: { projectId, status: "arquivado", documentTypeId: { not: null } },
    select: { id: true },
  });
  let processados = 0;
  for (const d of docs) {
    const id = await runExtractionForDocument(d.id);
    if (id) processados += 1;
  }
  return { processados };
}

type ExtracaoRow = {
  id: string;
  documentId: string;
  tipoDocumento: string;
  metodo: "deterministico" | "ia";
  confianca: number | null;
  camposExtraidos: unknown;
  nota: string | null;
  estado: FieldState;
  validatedAt: Date | null;
  createdAt: Date;
  document: { originalFilename: string; storedFilename: string | null };
  validatedBy: { fullName: string } | null;
};

function camposOf(row: ExtracaoRow): ExtractedField[] {
  return Array.isArray(row.camposExtraidos) ? (row.camposExtraidos as ExtractedField[]) : [];
}

/** Estado do separador Extração: fila, processadas e conflitos entre fontes. */
export async function buildExtracoesDTO(projectId: string): Promise<ProjectExtracoesDTO> {
  const cand = await prisma.candidatura.findUnique({ where: { projectId } });
  if (!cand) return { candidaturaId: null, queue: [], processed: [], conflicts: [] };

  const rows = (await prisma.extracao.findMany({
    where: { candidaturaId: cand.id },
    include: { document: true, validatedBy: true },
    orderBy: { createdAt: "asc" },
  })) as unknown as ExtracaoRow[];

  // conflitos: mesmo (section,key) proposto por >1 extração POR VALIDAR
  const pendingByField = new Map<string, ExtracaoRow[]>();
  for (const r of rows) {
    if (r.estado !== "por_validar") continue;
    for (const c of camposOf(r)) {
      const k = `${c.section}::${c.key}`;
      const arr = pendingByField.get(k) ?? [];
      arr.push(r);
      pendingByField.set(k, arr);
    }
  }
  const conflictKeys = new Set([...pendingByField.entries()].filter(([, v]) => v.length > 1).map(([k]) => k));

  const toDTO = (r: ExtracaoRow): ExtractaoDTO => ({
    id: r.id,
    documentId: r.documentId,
    documentName: r.document.storedFilename ?? r.document.originalFilename,
    tipoDocumento: r.tipoDocumento,
    tipoDocumentoLabel: docTypeName(r.tipoDocumento),
    metodo: r.metodo,
    confianca: r.confianca,
    estado: r.estado,
    nota: r.nota,
    campos: camposOf(r).map<ExtractaoFieldDTO>((c) => ({
      ...c,
      conflito: r.estado === "por_validar" && conflictKeys.has(`${c.section}::${c.key}`),
    })),
    validatedBy: r.validatedBy?.fullName ?? null,
    validatedAt: r.validatedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  });

  const conflicts: ExtractaoConflictDTO[] = [...conflictKeys].map((k) => {
    const sources = pendingByField.get(k) ?? [];
    const [section = "", key = ""] = k.split("::");
    const first = sources[0] ? camposOf(sources[0]).find((c) => c.section === section && c.key === key) : undefined;
    return {
      section,
      key,
      label: first?.label ?? key,
      fontes: sources.map((r) => ({
        extracaoId: r.id,
        documentName: r.document.storedFilename ?? r.document.originalFilename,
        value: camposOf(r).find((c) => c.section === section && c.key === key)?.value ?? null,
      })),
    };
  });

  return {
    candidaturaId: cand.id,
    queue: rows.filter((r) => r.estado === "por_validar").map(toDTO),
    processed: rows.filter((r) => r.estado !== "por_validar").map(toDTO),
    conflicts,
  };
}

export interface ValidateField {
  section: string;
  key: string;
  value?: unknown;
  accept: boolean;
}

/**
 * Confirma uma extração: para cada campo aceite, escreve/atualiza o CandField
 * com origem='extraido'. Aceitar sem alterar → estado 'validado'; corrigir o
 * valor → 'corrigido'. A proveniência (documento de origem) fica em sourceRef.
 */
export async function validateExtracao(
  extracaoId: string,
  fields: ValidateField[],
  userId: string,
): Promise<void> {
  const ext = await prisma.extracao.findUnique({ where: { id: extracaoId }, include: { document: true } });
  if (!ext) throw new Error("EXTRACAO_NOT_FOUND");
  if (ext.estado !== "por_validar") throw new Error("EXTRACAO_NOT_PENDING");

  const campos = Array.isArray(ext.camposExtraidos) ? (ext.camposExtraidos as unknown as ExtractedField[]) : [];
  const byKey = new Map(campos.map((c) => [`${c.section}::${c.key}`, c]));

  let corrigido = false;
  let escritos = 0;
  await prisma.$transaction(async (tx) => {
    for (const f of fields) {
      if (!f.accept) continue;
      const orig = byKey.get(`${f.section}::${f.key}`);
      if (!orig) continue;
      const overridden = Object.prototype.hasOwnProperty.call(f, "value");
      const value = (overridden ? f.value : orig.value) ?? null;
      const changed = overridden && JSON.stringify(value) !== JSON.stringify(orig.value ?? null);
      const state: FieldState = changed ? "corrigido" : "validado";
      if (changed) corrigido = true;
      escritos += 1;
      await tx.candField.upsert({
        where: { candidaturaId_section_key: { candidaturaId: ext.candidaturaId, section: f.section, key: f.key } },
        update: { value: value as object, origin: "extraido", state, sourceRef: ext.documentId, updatedById: userId },
        create: {
          candidaturaId: ext.candidaturaId,
          section: f.section,
          key: f.key,
          value: value as object,
          origin: "extraido",
          state,
          sourceRef: ext.documentId,
          updatedById: userId,
        },
      });
    }
    await tx.extracao.update({
      where: { id: extracaoId },
      data: { estado: corrigido ? "corrigido" : "validado", validatedById: userId, validatedAt: new Date() },
    });
    await tx.activityLog.create({
      data: {
        projectId: ext.document.projectId,
        userId,
        type: "extracao_validada",
        description: `Extração de ${docTypeName(ext.tipoDocumento)} validada: ${escritos} campo(s) na candidatura.`,
      },
    });
  });
}

/** Descarta uma extração da fila (não escreve nada na candidatura). */
export async function rejectExtracao(extracaoId: string, userId: string): Promise<void> {
  const ext = await prisma.extracao.findUnique({ where: { id: extracaoId }, include: { document: true } });
  if (!ext) throw new Error("EXTRACAO_NOT_FOUND");
  await prisma.$transaction([
    prisma.extracao.delete({ where: { id: extracaoId } }),
    prisma.activityLog.create({
      data: {
        projectId: ext.document.projectId,
        userId,
        type: "extracao_rejeitada",
        description: `Extração de ${docTypeName(ext.tipoDocumento)} descartada.`,
      },
    }),
  ]);
}
