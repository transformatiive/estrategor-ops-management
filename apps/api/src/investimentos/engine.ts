import { randomUUID } from "node:crypto";
import {
  anoDe,
  totaisPorAno,
  totaisPorCategoria,
  totalElegivel,
  valorRubrica,
  type FinanceiroMapas,
  type InvestimentoLinha,
  type InvestimentosDTO,
  type NovaInvestimentoLinha,
  type ResumoExecutivoDTO,
  type ResumoExecutivoIndicador,
} from "@estrategor/shared";
import { prisma } from "../db.js";

const SECTION = "investimentos";
const LINHAS_KEY = "linhas";

async function loadCand(projectId: string) {
  return prisma.candidatura.findUnique({ where: { projectId } });
}

function readLinhas(value: unknown): InvestimentoLinha[] {
  return Array.isArray(value) ? (value as InvestimentoLinha[]) : [];
}

async function loadLinhas(candidaturaId: string): Promise<InvestimentoLinha[]> {
  const f = await prisma.candField.findUnique({
    where: { candidaturaId_section_key: { candidaturaId, section: SECTION, key: LINHAS_KEY } },
  });
  return readLinhas(f?.value);
}

async function saveLinhas(candidaturaId: string, linhas: InvestimentoLinha[], userId: string): Promise<void> {
  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section: SECTION, key: LINHAS_KEY } },
    update: { value: linhas as object, origin: "intake", state: "validado", updatedById: userId },
    create: {
      candidaturaId,
      section: SECTION,
      key: LINHAS_KEY,
      value: linhas as object,
      origin: "intake",
      state: "validado",
      updatedById: userId,
    },
  });
}

function readMapas(value: unknown): FinanceiroMapas | null {
  if (value && typeof value === "object" && "anos" in (value as object)) {
    const v = value as FinanceiroMapas;
    return { anos: v.anos ?? [], balanco: v.balanco ?? {}, dr: v.dr ?? {}, financiamento: v.financiamento ?? {} };
  }
  return null;
}

async function loadFinanceira(candidaturaId: string): Promise<FinanceiroMapas | null> {
  const f = await prisma.candField.findUnique({
    where: { candidaturaId_section_key: { candidaturaId, section: "financeiro", key: "mapas" } },
  });
  return readMapas(f?.value);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const TOL = 1;

export async function buildInvestimentosDTO(projectId: string): Promise<InvestimentosDTO | null> {
  const cand = await loadCand(projectId);
  if (!cand) return null;

  const linhas = await loadLinhas(cand.id);
  const categorias = (
    await prisma.catalogoCategoriaCusto.findMany({ where: { familia: cand.family }, orderBy: { codigo: "asc" } })
  ).map((c) => ({ codigo: c.codigo, designacao: c.designacao }));

  const total = totalElegivel(linhas);
  const porAnoInv = totaisPorAno(linhas);

  // coerência com a componente financeira (custo_total por ano)
  const mapas = await loadFinanceira(cand.id);
  let custoFinanceira: number | null = null;
  const faseamento: { ano: string; investimentos: number; financeira: number; diff: number }[] = [];
  if (mapas) {
    custoFinanceira = 0;
    const anos = new Set<number>(mapas.anos);
    for (const k of Object.keys(porAnoInv)) if (/^\d{4}$/.test(k)) anos.add(Number(k));
    for (const ano of [...anos].sort((a, b) => a - b)) {
      const fin = valorRubrica(mapas, "financiamento", "custo_total", ano);
      const inv = porAnoInv[String(ano)] ?? 0;
      custoFinanceira = round2(custoFinanceira + fin);
      if (Math.abs(inv - fin) > TOL) faseamento.push({ ano: String(ano), investimentos: inv, financeira: fin, diff: round2(inv - fin) });
    }
  }
  const divergencia = custoFinanceira == null ? null : round2(total - custoFinanceira);
  const coincide = custoFinanceira == null ? null : custoFinanceira === 0 ? null : Math.abs(divergencia!) <= TOL;

  return {
    linhas,
    categorias,
    totaisPorCategoria: totaisPorCategoria(linhas),
    totaisPorAno: porAnoInv,
    totalElegivel: total,
    coerencia: { totalElegivel: total, custoFinanceira, divergencia, coincide, faseamentoPorAno: faseamento },
  };
}

function sanitize(input: NovaInvestimentoLinha): Omit<InvestimentoLinha, "id"> {
  return {
    designacao: String(input.designacao ?? "").trim(),
    categoria: String(input.categoria ?? "").trim(),
    atividade: input.atividade ?? null,
    estabelecimento: input.estabelecimento ?? null,
    dataAquisicao: input.dataAquisicao && /^\d{4}-\d{2}$/.test(input.dataAquisicao) ? input.dataAquisicao : null,
    elegivel: Number(input.elegivel) || 0,
    ef: Boolean(input.ef),
  };
}

export async function addLinha(projectId: string, input: NovaInvestimentoLinha, userId: string): Promise<void> {
  const cand = await loadCand(projectId);
  if (!cand) throw new Error("CANDIDATURA_NOT_FOUND");
  const linhas = await loadLinhas(cand.id);
  linhas.push({ id: randomUUID(), ...sanitize(input) });
  await saveLinhas(cand.id, linhas, userId);
}

export async function updateLinha(projectId: string, linhaId: string, input: NovaInvestimentoLinha, userId: string): Promise<void> {
  const cand = await loadCand(projectId);
  if (!cand) throw new Error("CANDIDATURA_NOT_FOUND");
  const linhas = await loadLinhas(cand.id);
  const idx = linhas.findIndex((l) => l.id === linhaId);
  if (idx < 0) throw new Error("LINHA_NOT_FOUND");
  linhas[idx] = { id: linhaId, ...sanitize(input) };
  await saveLinhas(cand.id, linhas, userId);
}

export async function deleteLinha(projectId: string, linhaId: string, userId: string): Promise<void> {
  const cand = await loadCand(projectId);
  if (!cand) throw new Error("CANDIDATURA_NOT_FOUND");
  const linhas = (await loadLinhas(cand.id)).filter((l) => l.id !== linhaId);
  await saveLinhas(cand.id, linhas, userId);
}

/**
 * Importa linhas do mapa de investimentos (TRNSF-1070). `modo` "append"
 * acrescenta às existentes; "replace" substitui-as. Devolve o nº importado.
 */
export async function importLinhas(
  projectId: string,
  novas: NovaInvestimentoLinha[],
  modo: "append" | "replace",
  userId: string,
): Promise<number> {
  const cand = await loadCand(projectId);
  if (!cand) throw new Error("CANDIDATURA_NOT_FOUND");
  const existentes = modo === "replace" ? [] : await loadLinhas(cand.id);
  const adicionadas = novas.map((l) => ({ id: randomUUID(), ...sanitize(l) }));
  await saveLinhas(cand.id, [...existentes, ...adicionadas], userId);
  return adicionadas.length;
}

/** Compila o Resumo Executivo: números calculados + texto gerado (TRNSF-943). */
export async function buildResumoExecutivo(projectId: string): Promise<ResumoExecutivoDTO | null> {
  const cand = await loadCand(projectId);
  if (!cand) return null;

  const fields = await prisma.candField.findMany({ where: { candidaturaId: cand.id } });
  const byKey = new Map(fields.map((f) => [`${f.section}::${f.key}`, f]));
  const pendentes: string[] = [];

  // objeto: texto gerado do resumo (descricao_operacao/resumo_pt)
  const objetoField = byKey.get("descricao_operacao::resumo_pt");
  const objeto = objetoField && typeof objetoField.value === "string" ? objetoField.value : null;
  if (!objeto) pendentes.push("Gerar o resumo da operação (separador Geração).");

  const linhas = readLinhas(byKey.get(`${SECTION}::${LINHAS_KEY}`)?.value);
  const invTotal = totalElegivel(linhas);
  if (linhas.length === 0) pendentes.push("Adicionar linhas de investimento.");

  // incentivo previsto: INR (apoio não reembolsável) da componente financeira
  const mapas = readMapas(byKey.get("financeiro::mapas")?.value);
  let incentivoPrevisto: number | null = null;
  if (mapas) {
    incentivoPrevisto = round2(mapas.anos.reduce((s, a) => s + valorRubrica(mapas, "financiamento", "inr", a), 0));
  } else {
    pendentes.push("Preencher a componente financeira (incentivo/financiamento).");
  }

  // indicadores-chave: VN, VAB (último ano) + emprego (beneficiário)
  const indicadores: ResumoExecutivoIndicador[] = [];
  const indField = byKey.get("financeiro::indicadores");
  const indList = Array.isArray(indField?.value)
    ? (indField!.value as { key: string; label: string; unidade: string; valores: Record<string, number | null> }[])
    : [];
  const ultimoAno = mapas && mapas.anos.length ? String(mapas.anos[mapas.anos.length - 1]) : null;
  for (const k of ["vn", "vab"]) {
    const ind = indList.find((i) => i.key === k);
    indicadores.push({
      key: k,
      label: ind?.label ?? k.toUpperCase(),
      unidade: ind?.unidade ?? "€",
      valor: ind && ultimoAno ? (ind.valores[ultimoAno] ?? null) : null,
    });
  }
  const emprego = byKey.get("beneficiario::eti")?.value ?? byKey.get("beneficiario::n_trabalhadores")?.value ?? null;
  indicadores.push({ key: "emprego", label: "Emprego (ETI)", unidade: "ETI", valor: typeof emprego === "number" ? emprego : null });
  indicadores.push({ key: "vni", label: "Volume de negócios internacional", unidade: "€", valor: null });
  if (indicadores.some((i) => i.valor == null)) pendentes.push("Concluir a componente financeira para os indicadores-chave.");

  return { objeto, investimentoTotalElegivel: invTotal, incentivoPrevisto, indicadores, pendentes };
}
