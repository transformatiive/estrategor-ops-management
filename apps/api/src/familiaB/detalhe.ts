import { randomUUID } from "node:crypto";
import {
  totalCustos,
  totalDeslocacoes,
  totalRh,
  valorRubrica,
  type FinanceiroMapas,
  type IntlAcao,
  type IntlAcaoCusto,
  type IntlDeslocacao,
  type IntlDetalheDTO,
  type IntlRh,
  type NovaIntlDeslocacao,
  type NovoIntlCusto,
  type NovoIntlRh,
} from "@estrategor/shared";
import { prisma } from "../db.js";

const SEC_CUSTOS = "intl_acao_custos";
const SEC_DESL = "intl_deslocacoes";
const SEC_RH = "intl_rh";

async function cand(projectId: string) {
  return prisma.candidatura.findUnique({ where: { projectId } });
}

async function loadList<T>(candidaturaId: string, section: string): Promise<T[]> {
  const f = await prisma.candField.findUnique({ where: { candidaturaId_section_key: { candidaturaId, section, key: "linhas" } } });
  return Array.isArray(f?.value) ? (f!.value as unknown as T[]) : [];
}

async function saveList(candidaturaId: string, section: string, linhas: unknown[], userId: string) {
  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section, key: "linhas" } },
    update: { value: linhas as object, origin: "intake", state: "validado", updatedById: userId },
    create: { candidaturaId, section, key: "linhas", value: linhas as object, origin: "intake", state: "validado", updatedById: userId },
  });
}

function readMapas(value: unknown): FinanceiroMapas | null {
  if (value && typeof value === "object" && "anos" in (value as object)) {
    const v = value as FinanceiroMapas;
    return { anos: v.anos ?? [], balanco: v.balanco ?? {}, dr: v.dr ?? {}, financiamento: v.financiamento ?? {} };
  }
  return null;
}

export async function buildIntlDetalheDTO(projectId: string): Promise<IntlDetalheDTO | null> {
  const c = await cand(projectId);
  if (!c) return null;

  const acoesField = await prisma.candField.findUnique({ where: { candidaturaId_section_key: { candidaturaId: c.id, section: "acoes_intl", key: "linhas" } } });
  const acoes = (Array.isArray(acoesField?.value) ? (acoesField!.value as unknown as IntlAcao[]) : []).map((a) => ({
    id: a.id,
    label: `${a.tipoAcao}${a.mercadoPais ? ` · ${a.mercadoPais}` : ""}${a.ano ? ` (${a.ano})` : ""}`,
  }));
  const rubricas = (await prisma.catalogoCategoriaCusto.findMany({ where: { familia: "internacionalizacao" }, orderBy: { codigo: "asc" } })).map((r) => ({ codigo: r.codigo, designacao: r.designacao }));

  const custos = await loadList<IntlAcaoCusto>(c.id, SEC_CUSTOS);
  const deslocacoes = await loadList<IntlDeslocacao>(c.id, SEC_DESL);
  const rh = await loadList<IntlRh>(c.id, SEC_RH);

  const tCustos = totalCustos(custos);
  const tDesl = totalDeslocacoes(deslocacoes);
  const tRh = totalRh(rh);
  const totalGlobal = Math.round((tCustos + tDesl + tRh) * 100) / 100;

  // coerência com a financeira (custo_total)
  const finField = await prisma.candField.findUnique({ where: { candidaturaId_section_key: { candidaturaId: c.id, section: "financeiro", key: "mapas" } } });
  const mapas = readMapas(finField?.value);
  let custoFinanceira: number | null = null;
  if (mapas) custoFinanceira = Math.round(mapas.anos.reduce((s, a) => s + valorRubrica(mapas, "financiamento", "custo_total", a), 0) * 100) / 100;
  const coincide = custoFinanceira == null || custoFinanceira === 0 ? null : Math.abs(totalGlobal - custoFinanceira) <= 1;

  return { acoes, rubricas, custos, deslocacoes, rh, totalCustos: tCustos, totalDeslocacoes: tDesl, totalRh: tRh, totalGlobal, custoFinanceira, coincide };
}

export async function addCusto(projectId: string, input: NovoIntlCusto, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const list = await loadList<IntlAcaoCusto>(c.id, SEC_CUSTOS);
  list.push({ id: randomUUID(), acaoId: input.acaoId, rubrica: input.rubrica, montante: input.montante ?? null, ano: input.ano ?? null });
  await saveList(c.id, SEC_CUSTOS, list, userId);
}

export async function deleteCusto(projectId: string, id: string, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  await saveList(c.id, SEC_CUSTOS, (await loadList<IntlAcaoCusto>(c.id, SEC_CUSTOS)).filter((x) => x.id !== id), userId);
}

export async function addDeslocacao(projectId: string, input: NovaIntlDeslocacao, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const list = await loadList<IntlDeslocacao>(c.id, SEC_DESL);
  list.push({
    id: randomUUID(),
    acaoId: input.acaoId,
    pessoa: String(input.pessoa ?? "").trim(),
    destino: input.destino ?? null,
    dias: input.dias ?? null,
    viagem: input.viagem ?? null,
    estadia: input.estadia ?? null,
    ajudasCusto: input.ajudasCusto ?? null,
  });
  await saveList(c.id, SEC_DESL, list, userId);
}

export async function deleteDeslocacao(projectId: string, id: string, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  await saveList(c.id, SEC_DESL, (await loadList<IntlDeslocacao>(c.id, SEC_DESL)).filter((x) => x.id !== id), userId);
}

export async function addRh(projectId: string, input: NovoIntlRh, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const list = await loadList<IntlRh>(c.id, SEC_RH);
  list.push({ id: randomUUID(), funcao: String(input.funcao ?? "").trim(), custo: input.custo ?? null, periodo: input.periodo ?? null });
  await saveList(c.id, SEC_RH, list, userId);
}

export async function deleteRh(projectId: string, id: string, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  await saveList(c.id, SEC_RH, (await loadList<IntlRh>(c.id, SEC_RH)).filter((x) => x.id !== id), userId);
}
