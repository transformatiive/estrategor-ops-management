import { randomUUID } from "node:crypto";
import type { IntlAcao, IntlAcoesDTO, NovaIntlAcao, UpdateIntlDominio } from "@estrategor/shared";
import { prisma } from "../db.js";

const SEC_DOM = "intl_dominios";
const SEC_ACOES = "acoes_intl";

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

type DomDados = Record<string, { aplicavel: boolean; contributo: string | null }>;

async function loadAcoes(candidaturaId: string): Promise<IntlAcao[]> {
  const f = await loadField(candidaturaId, SEC_ACOES, "linhas");
  return Array.isArray(f?.value) ? (f!.value as unknown as IntlAcao[]) : [];
}

export async function buildIntlAcoesDTO(projectId: string): Promise<IntlAcoesDTO | null> {
  const c = await cand(projectId);
  if (!c) return null;
  const catDom = await prisma.catalogoDominioIntl.findMany({ orderBy: { numero: "asc" } });
  const domField = await loadField(c.id, SEC_DOM, "dados");
  const dados = (domField?.value as unknown as DomDados) ?? {};
  return {
    dominios: catDom.map((d) => ({
      numero: d.numero,
      designacao: d.designacao,
      aplicavel: dados[String(d.numero)]?.aplicavel ?? false,
      contributo: dados[String(d.numero)]?.contributo ?? null,
    })),
    acoes: await loadAcoes(c.id),
  };
}

export async function updateDominio(projectId: string, input: UpdateIntlDominio, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const domField = await loadField(c.id, SEC_DOM, "dados");
  const dados = ((domField?.value as unknown as DomDados) ?? {}) as DomDados;
  const cur = dados[String(input.numero)] ?? { aplicavel: false, contributo: null };
  if (input.aplicavel !== undefined) cur.aplicavel = input.aplicavel;
  if (input.contributo !== undefined) cur.contributo = input.contributo;
  dados[String(input.numero)] = cur;
  await saveField(c.id, SEC_DOM, "dados", dados, userId);
}

export async function addAcao(projectId: string, input: NovaIntlAcao, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const list = await loadAcoes(c.id);
  list.push({
    id: randomUUID(),
    dominio: Number(input.dominio),
    tipoAcao: String(input.tipoAcao ?? "").trim(),
    mercadoPais: input.mercadoPais ?? null,
    ano: input.ano ?? null,
  });
  await saveField(c.id, SEC_ACOES, "linhas", list, userId);
}

export async function deleteAcao(projectId: string, id: string, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  await saveField(c.id, SEC_ACOES, "linhas", (await loadAcoes(c.id)).filter((a) => a.id !== id), userId);
}
