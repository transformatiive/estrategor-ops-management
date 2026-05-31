import { randomUUID } from "node:crypto";
import {
  TIPOLOGIAS,
  TIPOLOGIA_CAMPOS,
  TIPOLOGIA_LABELS,
  validarLimiares,
  type NovaTipologiaLinha,
  type TipologiaLinha,
  type TipologiasDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";

const SECTION = "tipologia";
const KEY = "linhas";

async function cand(projectId: string) {
  return prisma.candidatura.findUnique({ where: { projectId } });
}

function readLinhas(value: unknown): TipologiaLinha[] {
  return Array.isArray(value) ? (value as TipologiaLinha[]) : [];
}

async function load(candidaturaId: string): Promise<TipologiaLinha[]> {
  const f = await prisma.candField.findUnique({
    where: { candidaturaId_section_key: { candidaturaId, section: SECTION, key: KEY } },
  });
  return readLinhas(f?.value);
}

async function save(candidaturaId: string, linhas: TipologiaLinha[], userId: string) {
  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section: SECTION, key: KEY } },
    update: { value: linhas as object, origin: "intake", state: "validado", updatedById: userId },
    create: { candidaturaId, section: SECTION, key: KEY, value: linhas as object, origin: "intake", state: "validado", updatedById: userId },
  });
}

export async function buildTipologiasDTO(projectId: string): Promise<TipologiasDTO | null> {
  const c = await cand(projectId);
  if (!c) return null;
  const linhas = await load(c.id);
  const issues = linhas.flatMap((l) => validarLimiares(l).map((mensagem) => ({ id: l.id, tipo: l.tipo, mensagem })));
  return {
    linhas,
    disponiveis: TIPOLOGIAS.map((t) => ({ tipo: t, label: TIPOLOGIA_LABELS[t], campos: TIPOLOGIA_CAMPOS[t] })),
    issues,
  };
}

export async function addTipologia(projectId: string, input: NovaTipologiaLinha, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  if (!TIPOLOGIAS.includes(input.tipo)) throw new Error("TIPO_UNKNOWN");
  const linhas = await load(c.id);
  linhas.push({ id: randomUUID(), tipo: input.tipo, dados: input.dados ?? {} });
  await save(c.id, linhas, userId);
}

export async function updateTipologia(projectId: string, id: string, dados: Record<string, string | number | null>, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const linhas = await load(c.id);
  const idx = linhas.findIndex((l) => l.id === id);
  if (idx < 0) throw new Error("LINHA_NOT_FOUND");
  linhas[idx] = { ...linhas[idx]!, dados };
  await save(c.id, linhas, userId);
}

export async function deleteTipologia(projectId: string, id: string, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  await save(c.id, (await load(c.id)).filter((l) => l.id !== id), userId);
}
