import { randomUUID } from "node:crypto";
import {
  INDICADOR_FONTE_FINANCEIRA,
  type AtividadeLinha,
  type AtividadesIndicadoresDTO,
  type CandIndicadorLinha,
  type NovaAtividade,
  type NovoIndicador,
} from "@estrategor/shared";
import { prisma } from "../db.js";

const SEC_ATIV = "atividades_inovacao";
const SEC_IND = "indicadores";
const KEY = "linhas";

async function cand(projectId: string) {
  return prisma.candidatura.findUnique({ where: { projectId } });
}

async function loadList<T>(candidaturaId: string, section: string): Promise<T[]> {
  const f = await prisma.candField.findUnique({ where: { candidaturaId_section_key: { candidaturaId, section, key: KEY } } });
  return Array.isArray(f?.value) ? (f!.value as T[]) : [];
}

async function saveList(candidaturaId: string, section: string, linhas: unknown[], userId: string, origin: "intake" | "calculado" = "intake") {
  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section, key: KEY } },
    update: { value: linhas as object, origin, state: "validado", updatedById: userId },
    create: { candidaturaId, section, key: KEY, value: linhas as object, origin, state: "validado", updatedById: userId },
  });
}

export async function buildAtividadesDTO(projectId: string): Promise<AtividadesIndicadoresDTO | null> {
  const c = await cand(projectId);
  if (!c) return null;
  const atividades = await loadList<AtividadeLinha>(c.id, SEC_ATIV);
  const indicadores = await loadList<CandIndicadorLinha>(c.id, SEC_IND);
  const catalogo = (await prisma.catalogoIndicador.findMany({ orderBy: { codigo: "asc" } })).map((i) => ({
    codigo: i.codigo,
    designacao: i.designacao,
    unidade: i.unidade,
  }));
  return { atividades, indicadores, catalogo };
}

export async function addAtividade(projectId: string, input: NovaAtividade, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const list = await loadList<AtividadeLinha>(c.id, SEC_ATIV);
  list.push({ id: randomUUID(), designacao: String(input.designacao ?? "").trim() });
  await saveList(c.id, SEC_ATIV, list, userId);
}

export async function deleteAtividade(projectId: string, id: string, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  await saveList(c.id, SEC_ATIV, (await loadList<AtividadeLinha>(c.id, SEC_ATIV)).filter((a) => a.id !== id), userId);
}

export async function addIndicador(projectId: string, input: NovoIndicador, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const cat = await prisma.catalogoIndicador.findUnique({ where: { codigo: input.codigo } });
  if (!cat) throw new Error("INDICADOR_UNKNOWN");
  const list = await loadList<CandIndicadorLinha>(c.id, SEC_IND);
  list.push({
    id: randomUUID(),
    codigo: input.codigo,
    valorPre: input.valorPre ?? null,
    valorMeta: input.valorMeta ?? null,
    unidade: cat.unidade,
    fonte: "intake",
  });
  await saveList(c.id, SEC_IND, list, userId);
}

export async function updateIndicador(projectId: string, id: string, valorPre: number | null, valorMeta: number | null, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const list = await loadList<CandIndicadorLinha>(c.id, SEC_IND);
  const idx = list.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error("LINHA_NOT_FOUND");
  list[idx] = { ...list[idx]!, valorPre, valorMeta };
  await saveList(c.id, SEC_IND, list, userId);
}

export async function deleteIndicador(projectId: string, id: string, userId: string): Promise<void> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  await saveList(c.id, SEC_IND, (await loadList<CandIndicadorLinha>(c.id, SEC_IND)).filter((i) => i.id !== id), userId);
}

/** Sugere indicadores calculáveis a partir da componente financeira (TRNSF-944). */
export async function suggestIndicadores(projectId: string, userId: string): Promise<number> {
  const c = await cand(projectId);
  if (!c) throw new Error("CANDIDATURA_NOT_FOUND");
  const finField = await prisma.candField.findUnique({
    where: { candidaturaId_section_key: { candidaturaId: c.id, section: "financeiro", key: "indicadores" } },
  });
  const finInd = Array.isArray(finField?.value)
    ? (finField!.value as { key: string; valores: Record<string, number | null> }[])
    : [];
  if (finInd.length === 0) return 0;

  const list = await loadList<CandIndicadorLinha>(c.id, SEC_IND);
  let added = 0;
  for (const [codigo, finKey] of Object.entries(INDICADOR_FONTE_FINANCEIRA)) {
    if (list.some((i) => i.codigo === codigo)) continue;
    const ind = finInd.find((f) => f.key === finKey);
    if (!ind) continue;
    const anos = Object.keys(ind.valores).filter((k) => /^\d{4}$/.test(k)).sort();
    const cat = await prisma.catalogoIndicador.findUnique({ where: { codigo } });
    list.push({
      id: randomUUID(),
      codigo,
      valorPre: anos.length ? ind.valores[anos[0]!] ?? null : null,
      valorMeta: anos.length ? ind.valores[anos[anos.length - 1]!] ?? null : null,
      unidade: cat?.unidade ?? null,
      fonte: "calculado",
    });
    added += 1;
  }
  if (added) await saveList(c.id, SEC_IND, list, userId);
  return added;
}
