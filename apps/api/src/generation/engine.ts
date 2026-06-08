import {
  countPlaceholders,
  genDocType,
  genDocTypeByTarget,
  genDocTypesForFamily,
  type CandFamily,
  type CandidaturaGeracaoDTO,
  type FieldState,
  type GenDocTypeDef,
  type GeneratedFieldDTO,
} from "@estrategor/shared";
import { CAND_FAMILY_LABELS } from "@estrategor/shared";
import { prisma } from "../db.js";
import { generateText, type GenSources } from "./prompt.js";

/** Resume um valor de CandField para o dossier (texto curto). */
function summariseValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value.length > 200 ? value.slice(0, 200) + "…" : value;
  if (typeof value === "number") return value.toLocaleString("pt-PT");
  return JSON.stringify(value).slice(0, 200);
}

/**
 * Reúne as fontes da geração: o dossier de factos já na candidatura (campos
 * intake/extraído/calculado/validados) e a orientação da grelha de mérito.
 */
async function gatherSources(
  candidaturaId: string,
  family: CandFamily,
  codigoAviso: string | null,
  projectId: string,
): Promise<GenSources> {
  const fields = await prisma.candField.findMany({
    where: { candidaturaId },
    orderBy: [{ section: "asc" }, { key: "asc" }],
  });
  // só factos (não outros campos gerados, para não realimentar a IA consigo mesma)
  const dossier = fields
    .filter((f) => f.origin !== "gerado")
    .map((f) => `- ${f.section}.${f.key}: ${summariseValue(f.value)}`)
    .join("\n");

  const diag = await prisma.diagnostic.findUnique({
    where: { projectId },
    include: { meritGrid: true },
  });
  let meritGuidance = "";
  const grid = diag?.meritGrid?.grid as { criterios?: { codigo?: string; designacao?: string }[] } | undefined;
  if (Array.isArray(grid?.criterios)) {
    meritGuidance = grid!.criterios!
      .map((c) => `- ${c.codigo ?? ""} ${c.designacao ?? ""}`.trim())
      .join("\n");
  }

  return { familyLabel: CAND_FAMILY_LABELS[family], codigoAviso, dossier, meritGuidance };
}

/** Verifica a configuração mínima para gerar (não gerar às cegas). */
async function configMissing(
  candidatura: { codigoAviso: string | null; projectId: string },
): Promise<string | null> {
  if (!candidatura.codigoAviso) return "Falta o código do aviso na candidatura.";
  const diag = await prisma.diagnostic.findUnique({ where: { projectId: candidatura.projectId } });
  if (!diag?.meritGridId) return "Falta a grelha de mérito (conclua o diagnóstico A0).";
  return null;
}

export class GenerationError extends Error {}

/**
 * Gera a minuta de UM campo de texto e preenche o CandField correspondente com
 * origem='gerado', estado='por_validar'. Valida o limite de caracteres (regenera
 * uma vez mais curto se exceder) e versiona cada geração em generated_documents.
 */
export async function generateField(
  projectId: string,
  docType: string,
  userId: string,
): Promise<GeneratedFieldDTO> {
  const def = genDocType(docType);
  if (!def) throw new GenerationError("DOC_TYPE_UNKNOWN");

  const cand = await prisma.candidatura.findUnique({ where: { projectId } });
  if (!cand) throw new GenerationError("CANDIDATURA_NOT_FOUND");
  if (def.scope !== "comum" && def.scope !== cand.family) throw new GenerationError("DOC_TYPE_FAMILY_MISMATCH");

  const missing = await configMissing(cand);
  if (missing) throw new GenerationError(`CONFIG_MISSING:${missing}`);

  const sources = await gatherSources(cand.id, cand.family, cand.codigoAviso, projectId);

  const first = await generateText(def, sources);
  let conteudo = first.conteudo;
  let viaIa = first.viaIa;
  let motivo = first.motivo;
  // limite de caracteres: se exceder, tenta regenerar mais curto (uma vez)
  if (conteudo.length > def.charLimit) {
    const retry = await generateText(def, sources, Math.floor(def.charLimit * 0.95));
    if (retry.conteudo.length < conteudo.length) {
      conteudo = retry.conteudo;
      viaIa = retry.viaIa;
      motivo = retry.motivo;
    }
  }

  const last = await prisma.generatedField.findFirst({
    where: { candidaturaId: cand.id, docType },
    orderBy: { versao: "desc" },
  });
  const versao = (last?.versao ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    await tx.generatedField.create({
      data: {
        candidaturaId: cand.id,
        docType,
        family: cand.family,
        versao,
        estado: "por_validar",
        conteudo,
        dataSources: { grelhaId: undefined, dossierCampos: sources.dossier ? sources.dossier.split("\n").length : 0 } as object,
        charLimit: def.charLimit,
        charCount: conteudo.length,
      },
    });
    await tx.candField.upsert({
      where: { candidaturaId_section_key: { candidaturaId: cand.id, section: def.section, key: def.key } },
      update: { value: conteudo as unknown as object, origin: "gerado", state: "por_validar", sourceRef: `gen:${docType}:v${versao}`, updatedById: userId },
      create: {
        candidaturaId: cand.id,
        section: def.section,
        key: def.key,
        value: conteudo as unknown as object,
        origin: "gerado",
        state: "por_validar",
        sourceRef: `gen:${docType}:v${versao}`,
        updatedById: userId,
      },
    });
    await tx.activityLog.create({
      data: {
        projectId,
        userId,
        type: "minuta_gerada",
        description: `Minuta gerada: ${def.label} (v${versao}, ${conteudo.length}/${def.charLimit} car.).`,
      },
    });
  });

  return { ...toFieldDTO(def, "por_validar", conteudo, versao), viaIa, motivo: motivo ?? null };
}

function toFieldDTO(
  def: GenDocTypeDef,
  estado: FieldState | null,
  conteudo: string | null,
  versao: number,
): GeneratedFieldDTO {
  const text = conteudo ?? "";
  return {
    docType: def.docType,
    label: def.label,
    section: def.section,
    key: def.key,
    scope: def.scope,
    charLimit: def.charLimit,
    model: def.model,
    condicional: def.condicional ?? false,
    estado,
    conteudo,
    charCount: text.length,
    excedeLimite: text.length > def.charLimit,
    placeholders: countPlaceholders(text),
    versao,
  };
}

/** Estado do painel de geração: todos os doc_types da família + estado atual. */
export async function buildGeracaoDTO(projectId: string): Promise<CandidaturaGeracaoDTO | null> {
  const cand = await prisma.candidatura.findUnique({ where: { projectId } });
  if (!cand) return null;

  const fields = await prisma.candField.findMany({ where: { candidaturaId: cand.id } });
  const byKey = new Map(fields.map((f) => [`${f.section}::${f.key}`, f]));
  const versions = await prisma.generatedField.groupBy({
    by: ["docType"],
    where: { candidaturaId: cand.id },
    _max: { versao: true },
  });
  const versByDoc = new Map(versions.map((v) => [v.docType, v._max.versao ?? 0]));

  const defs = genDocTypesForFamily(cand.family);
  const campos = defs.map((def) => {
    const cf = byKey.get(`${def.section}::${def.key}`);
    const conteudo = cf && typeof cf.value === "string" ? cf.value : cf?.value != null ? String(cf.value) : null;
    // só reportamos estado de geração quando o campo é mesmo 'gerado'
    const estado = cf && cf.origin === "gerado" ? (cf.state as FieldState) : null;
    return toFieldDTO(def, estado, estado ? conteudo : null, versByDoc.get(def.docType) ?? 0);
  });

  return {
    candidaturaId: cand.id,
    family: cand.family,
    configMissing: await configMissing(cand),
    campos,
  };
}

/**
 * Versiona uma edição manual de um campo gerado (chamado pelo PATCH da
 * candidatura quando se corrige um campo origem='gerado'). Marca corrigido.
 */
export async function versionGeneratedEdit(
  candidaturaId: string,
  section: string,
  key: string,
  conteudo: string,
  userId: string,
): Promise<void> {
  // descobre o doc_type pelo (section,key)
  const def = genDocTypeByTarget(section, key);
  if (!def) return;
  const last = await prisma.generatedField.findFirst({
    where: { candidaturaId, docType: def.docType },
    orderBy: { versao: "desc" },
  });
  await prisma.generatedField.create({
    data: {
      candidaturaId,
      docType: def.docType,
      family: last?.family ?? "inovacao_produtiva",
      versao: (last?.versao ?? 0) + 1,
      estado: "corrigido",
      conteudo,
      charLimit: def.charLimit,
      charCount: conteudo.length,
      validatedById: userId,
      validatedAt: new Date(),
    },
  });
}
