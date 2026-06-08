/**
 * Sincronização dos avisos PT2030 → grelhas de mérito rascunho (TRNSF-1072 · F1+F3).
 *
 * Pensado para correr no Railway (cron, à noite): busca os avisos abertos do
 * portal e, para cada um sem grelha, descarrega o PDF e propõe a grelha via IA
 * (`extrairGrelhaDoAviso`) — guardando-a como RASCUNHO (extracted=false), que o
 * admin revê e publica no editor. No dia seguinte "as matrizes estão prontas".
 *
 * Idempotente: o próprio `merit_grids` é o estado — não se reconstrói uma grelha
 * cujo `codigoAviso` já existe. F2 (filtro de relevância) ainda não tem critérios,
 * por isso processam-se todos os avisos abertos.
 */

import { prisma } from "../db.js";
import { extrairGrelhaDoAviso } from "../extraction/grelha.js";
import { fetchAvisos2030, isOpen, resolvePdfUrl, type Aviso2030 } from "./source.js";

export interface BuildResultado {
  total: number;
  abertos: number;
  criadas: number;
  ignoradas: number; // já existiam ou sem PDF
  erros: number;
  detalhes: { codigo: string; estado: "criada" | "existente" | "sem_pdf" | "erro"; nota?: string }[];
}

/** Lista os avisos abertos do portal (resumo, sem construir nada). */
export async function listOpenAvisos2030(): Promise<Aviso2030[]> {
  const todos = await fetchAvisos2030();
  return todos.filter((a) => isOpen(a));
}

/** Versão por defeito quando o aviso não traz versão própria (data ou ano). */
function versaoDe(a: Aviso2030, metaVersao: string): string {
  if (metaVersao?.trim()) return metaVersao.trim();
  if (a.dataInicio) return a.dataInicio.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/**
 * Constrói grelhas rascunho para os avisos abertos ainda sem grelha.
 * `limit` limita o nº processado por execução (controla custo/tempo da IA).
 */
export async function buildGridsForOpenAvisos(opts: { limit?: number } = {}): Promise<BuildResultado> {
  const limit = opts.limit ?? 10;
  const todos = await fetchAvisos2030();
  const abertos = todos.filter((a) => isOpen(a));

  const res: BuildResultado = {
    total: todos.length,
    abertos: abertos.length,
    criadas: 0,
    ignoradas: 0,
    erros: 0,
    detalhes: [],
  };

  for (const a of abertos) {
    if (res.criadas >= limit) break;

    // dedup: já existe grelha para este código de aviso?
    const existente = await prisma.meritGrid.findFirst({ where: { codigoAviso: a.codigo } });
    if (existente) {
      res.ignoradas += 1;
      res.detalhes.push({ codigo: a.codigo, estado: "existente" });
      continue;
    }
    if (!a.pdfMediaId) {
      res.ignoradas += 1;
      res.detalhes.push({ codigo: a.codigo, estado: "sem_pdf", nota: "Aviso sem PDF associado." });
      continue;
    }

    try {
      const pdfUrl = await resolvePdfUrl(a.pdfMediaId);
      if (!pdfUrl) {
        res.ignoradas += 1;
        res.detalhes.push({ codigo: a.codigo, estado: "sem_pdf", nota: "PDF não resolúvel." });
        continue;
      }
      const proposta = await extrairGrelhaDoAviso(pdfUrl);
      const m = proposta.metadata;
      await prisma.meritGrid.create({
        data: {
          programCode: m.programCode || "PT2030",
          measure: (m.medida || a.titulo).slice(0, 250),
          codigoAviso: a.codigo, // força o código do portal (chave de dedup)
          regiao: m.regiao,
          versao: versaoDe(a, m.versao),
          fonteUrl: pdfUrl,
          mpMinimo: m.mp_minimo,
          minimoPorCriterio: m.minimo_por_criterio,
          formulaMp: m.formula_mp || null,
          grid: proposta.grid as object,
          accessConditions: proposta.accessConditions as object,
          eligibilidade: proposta.eligibilidade as object,
          extracted: false, // RASCUNHO — o admin revê e publica
        },
      });
      res.criadas += 1;
      res.detalhes.push({ codigo: a.codigo, estado: "criada", nota: proposta.nota || undefined });
    } catch (e) {
      res.erros += 1;
      res.detalhes.push({
        codigo: a.codigo,
        estado: "erro",
        nota: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return res;
}
