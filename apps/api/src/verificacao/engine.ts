import {
  computeMerit,
  type MeritGridData,
  type MeritSelection,
  type NaoConformidade,
  type MeritoCriterioDTO,
  type VerificacaoDTO,
  type VerifResultado,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { buildGeracaoDTO } from "../generation/engine.js";
import { buildFinanceiroDTO } from "../financial/engine.js";
import { buildInvestimentosDTO } from "../investimentos/engine.js";

const eur = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 0 }) + " €";

/** Eixo FORMULÁRIO: campos de texto gerados em falta, [A PREENCHER], limites. */
async function eixoFormulario(projectId: string, candidaturaId: string): Promise<NaoConformidade[]> {
  const nc: NaoConformidade[] = [];
  const ger = await buildGeracaoDTO(projectId);
  if (ger) {
    for (const c of ger.campos) {
      if (c.condicional && c.estado === null) continue; // condicionais não geram erro só por não existir
      if (c.estado === null) {
        nc.push({ eixo: "formulario", gravidade: "erro", mensagem: `Campo de texto por gerar: ${c.label}.`, seccao: c.section });
      } else {
        if (c.placeholders > 0) {
          nc.push({ eixo: "formulario", gravidade: "erro", mensagem: `${c.label}: ${c.placeholders} marcador(es) [A PREENCHER] por resolver.`, seccao: c.section });
        }
        if (c.excedeLimite) {
          nc.push({ eixo: "formulario", gravidade: "aviso", mensagem: `${c.label}: excede o limite de ${c.charLimit} caracteres.`, seccao: c.section });
        }
        if (c.estado === "por_validar") {
          nc.push({ eixo: "formulario", gravidade: "aviso", mensagem: `${c.label}: gerado por validar.`, seccao: c.section });
        }
      }
    }
  }
  // TRNSF-957 — se houver indicadores RPA, a fundamentação RPA é obrigatória
  const indField = await prisma.candField.findUnique({
    where: { candidaturaId_section_key: { candidaturaId, section: "indicadores", key: "linhas" } },
  });
  const codigos = Array.isArray(indField?.value) ? (indField!.value as { codigo: string }[]).map((i) => i.codigo) : [];
  if (codigos.some((c) => c.toUpperCase().startsWith("RPA"))) {
    const rpaField = ger?.campos.find((c) => c.docType === "fundamentacao_indicadores_rpa");
    if (rpaField && rpaField.estado === null) {
      nc.push({ eixo: "formulario", gravidade: "erro", mensagem: "Há indicadores RPA — a fundamentação dos indicadores RPA é obrigatória.", seccao: "indicadores" });
    }
  }

  // anexos obrigatórios da família (confirmação manual — não verificável por upload aqui)
  const cand = await prisma.candidatura.findUnique({ where: { id: candidaturaId } });
  if (cand) {
    const anexos = await prisma.catalogoAnexo.findMany({ where: { familia: cand.family, obrigatorio: true } });
    if (anexos.length) {
      nc.push({
        eixo: "formulario",
        gravidade: "aviso",
        mensagem: `Confirmar presença de ${anexos.length} anexo(s) obrigatório(s) da família.`,
        seccao: "anexos",
      });
    }
  }
  return nc;
}

/** Eixo MÉRITO: MP determinístico da grelha (TRNSF-941) + indicadores (944). */
async function eixoMerito(projectId: string): Promise<{
  nc: NaoConformidade[];
  mpPrevisto: number | null;
  mpMinimo: number | null;
  atingeMinimo: boolean | null;
  criterios: MeritoCriterioDTO[];
  semGrelha: boolean;
}> {
  const diag = await prisma.diagnostic.findUnique({ where: { projectId }, include: { meritGrid: true } });
  const grid = diag?.meritGrid?.grid as MeritGridData | undefined;
  if (!diag || !grid) {
    return {
      nc: [{ eixo: "merito", gravidade: "aviso", mensagem: "Sem grelha de mérito para o aviso — MP não calculado (conclua o A0).", seccao: "criterios_selecao" }],
      mpPrevisto: null, mpMinimo: null, atingeMinimo: null, criterios: [], semGrelha: true,
    };
  }
  const selection = (diag.meritInputs ?? {}) as MeritSelection;
  const result = computeMerit(grid, selection, diag.regiao);
  const nc: NaoConformidade[] = [];
  if (result.missing.length) {
    nc.push({ eixo: "merito", gravidade: "aviso", mensagem: `${result.missing.length} subcritério(s) por avaliar: ${result.missing.slice(0, 5).join(", ")}${result.missing.length > 5 ? "…" : ""}.`, seccao: "criterios_selecao" });
  }
  for (const c of result.criteria) {
    if (c.belowMinimum) {
      nc.push({ eixo: "merito", gravidade: "aviso", mensagem: `Critério ${c.codigo} (${c.nome}) abaixo do mínimo: ${c.score}.`, seccao: "criterios_selecao" });
    }
  }
  if (!result.meetsMpMinimo) {
    nc.push({ eixo: "merito", gravidade: "erro", mensagem: `MP previsto ${result.mp} abaixo do mínimo do aviso (${grid.mp_minimo}).`, seccao: "criterios_selecao" });
  }
  return {
    nc,
    mpPrevisto: result.mp,
    mpMinimo: grid.mp_minimo,
    atingeMinimo: result.meetsMpMinimo,
    criterios: result.criteria.map((c) => ({ codigo: c.codigo, nome: c.nome, peso: c.peso, score: c.score, belowMinimum: c.belowMinimum })),
    semGrelha: false,
  };
}

/** Eixo COERÊNCIA: investimento (945) = financiamento (944); balanço; GAF×A0. */
async function eixoCoerencia(projectId: string): Promise<NaoConformidade[]> {
  const nc: NaoConformidade[] = [];
  const inv = await buildInvestimentosDTO(projectId);
  if (inv && inv.coerencia.coincide === false) {
    nc.push({
      eixo: "coerencia",
      gravidade: "erro",
      mensagem: `Investimento elegível (${eur(inv.coerencia.totalElegivel)}) ≠ custo da componente financeira (${eur(inv.coerencia.custoFinanceira ?? 0)}); diferença ${eur(inv.coerencia.divergencia ?? 0)}.`,
      seccao: "investimentos",
    });
  }
  const fin = await buildFinanceiroDTO(projectId);
  if (fin) {
    for (const c of fin.coherence) {
      nc.push({ eixo: "coerencia", gravidade: "erro", mensagem: c.mensagem, seccao: "financeiro" });
    }
  }
  return nc;
}

/** Corre a verificação completa, persiste e devolve o DTO. */
export async function runVerificacao(projectId: string): Promise<VerificacaoDTO | null> {
  const cand = await prisma.candidatura.findUnique({ where: { projectId } });
  if (!cand) return null;

  const [form, merito, coer] = await Promise.all([
    eixoFormulario(projectId, cand.id),
    eixoMerito(projectId),
    eixoCoerencia(projectId),
  ]);
  const naoConformidades = [...form, ...merito.nc, ...coer];

  const temErro = naoConformidades.some((n) => n.gravidade === "erro");
  const resultado: VerifResultado = merito.semGrelha ? "sem_grelha" : temErro ? "nao_conforme" : "conforme";

  const row = await prisma.verificacao.create({
    data: {
      candidaturaId: cand.id,
      resultado,
      naoConformidades: naoConformidades as object,
      mpPrevisto: merito.mpPrevisto,
      mpPorCriterio: merito.criterios as object,
    },
  });

  return {
    resultado,
    naoConformidades,
    mpPrevisto: merito.mpPrevisto,
    mpMinimo: merito.mpMinimo,
    atingeMinimo: merito.atingeMinimo,
    mpPorCriterio: merito.criterios,
    criadoEm: row.criadoEm.toISOString(),
  };
}

/** Última verificação persistida (sem correr de novo), ou estado vazio. */
export async function lastVerificacao(projectId: string): Promise<VerificacaoDTO | null> {
  const cand = await prisma.candidatura.findUnique({ where: { projectId } });
  if (!cand) return null;
  const row = await prisma.verificacao.findFirst({ where: { candidaturaId: cand.id }, orderBy: { criadoEm: "desc" } });
  if (!row) {
    return { resultado: "nao_conforme", naoConformidades: [], mpPrevisto: null, mpMinimo: null, atingeMinimo: null, mpPorCriterio: [], criadoEm: null };
  }
  const merito = await eixoMerito(projectId); // recalcula MP/mínimo (determinístico, barato) para a vista de critérios
  return {
    resultado: row.resultado as VerifResultado,
    naoConformidades: (Array.isArray(row.naoConformidades) ? row.naoConformidades : []) as unknown as NaoConformidade[],
    mpPrevisto: row.mpPrevisto,
    mpMinimo: merito.mpMinimo,
    atingeMinimo: merito.atingeMinimo,
    mpPorCriterio: (Array.isArray(row.mpPorCriterio) ? row.mpPorCriterio : merito.criterios) as unknown as MeritoCriterioDTO[],
    criadoEm: row.criadoEm.toISOString(),
  };
}
