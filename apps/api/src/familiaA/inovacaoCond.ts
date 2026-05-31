import { randomUUID } from "node:crypto";
import {
  emptyDescricaoFisica,
  type DescricaoFisicaDados,
  type InovacaoCondDTO,
  type NovaSubstituicaoLinha,
  type SubstituicaoLinha,
} from "@estrategor/shared";
import { prisma } from "../db.js";

const SEC_SUB = "substituicao_importacoes";
const SEC_DF = "descricao_fisica";

async function cand(projectId: string) {
  return prisma.candidatura.findUnique({ where: { projectId } });
}

async function loadField(candidaturaId: string, section: string, key: string) {
  return prisma.candField.findUnique({ where: { candidaturaId_section_key: { candidaturaId, section, key } } });
}

async function saveField(candidaturaId: string, section: string, key: string, value: unknown, userId: string) {
  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section, key } },
    update: { value: value as object, origin: "intake", state: "validado", updatedById: userId },
    create: { candidaturaId, section, key, value: value as object, origin: "intake", state: "validado", updatedById: userId },
  });
}

async function loadSub(candidaturaId: string): Promise<SubstituicaoLinha[]> {
  const f = await loadField(candidaturaId, SEC_SUB, "linhas");
  return Array.isArray(f?.value) ? (f!.value as unknown as SubstituicaoLinha[]) : [];
}

export async function buildInovacaoCondDTO(projectId: string): Promise<InovacaoCondDTO | null> {
  const c = await cand(projectId);
  if (!c) return null;
  const df = await loadField(c.id, SEC_DF, "dados");
  return {
    substituicao: await loadSub(c.id),
    descricaoFisica: (df?.value as unknown as DescricaoFisicaDados) ?? emptyDescricaoFisica(),
  };
}

export async function addSubstituicao(projectId: string, input: NovaSubstituicaoLinha, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const list = await loadSub(c.id);
  list.push({
    id: randomUUID(),
    produto: String(input.produto ?? "").trim(),
    mercadoPais: input.mercadoPais ?? null,
    valorImportado: input.valorImportado ?? null,
    producaoNacionalPrevista: input.producaoNacionalPrevista ?? null,
  });
  await saveField(c.id, SEC_SUB, "linhas", list, userId);
}

export async function deleteSubstituicao(projectId: string, id: string, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  await saveField(c.id, SEC_SUB, "linhas", (await loadSub(c.id)).filter((l) => l.id !== id), userId);
}

export async function updateDescricaoFisica(projectId: string, dados: DescricaoFisicaDados, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  await saveField(c.id, SEC_DF, "dados", dados, userId);
}
