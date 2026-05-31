import { randomUUID } from "node:crypto";
import {
  META_INDICADOR_CODIGO,
  TIPOLOGIAS,
  TIPOLOGIA_LABELS,
  emptyIntakeInovacao,
  type IntakeInovacaoAnswers,
  type IntakeInovacaoDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";

const SEC_INTAKE = "intake_inovacao";

/** Resolve o token público → candidatura da família Inovação (ou null). */
async function candByToken(token: string) {
  const link = await prisma.collectionLink.findUnique({ where: { token }, include: { project: true } });
  if (!link) return null;
  const cand = await prisma.candidatura.findUnique({ where: { projectId: link.projectId } });
  if (!cand || cand.family !== "inovacao_produtiva") return { cand: null, projectId: link.projectId };
  return { cand, projectId: link.projectId };
}

async function readAnswers(candidaturaId: string): Promise<IntakeInovacaoAnswers> {
  const f = await prisma.candField.findUnique({ where: { candidaturaId_section_key: { candidaturaId, section: SEC_INTAKE, key: "respostas" } } });
  return (f?.value as unknown as IntakeInovacaoAnswers) ?? emptyIntakeInovacao();
}

export async function buildIntakeInovacaoDTO(token: string): Promise<IntakeInovacaoDTO | null> {
  const resolved = await candByToken(token);
  if (!resolved) return null; // ligação inválida
  if (!resolved.cand) return { aplica: false, categorias: [], tipologias: [], answers: emptyIntakeInovacao() };
  const categorias = (await prisma.catalogoCategoriaCusto.findMany({ where: { familia: "inovacao_produtiva" }, orderBy: { codigo: "asc" } })).map((c) => ({ codigo: c.codigo, designacao: c.designacao }));
  return {
    aplica: true,
    categorias,
    tipologias: TIPOLOGIAS.map((t) => ({ tipo: t, label: TIPOLOGIA_LABELS[t] })),
    answers: await readAnswers(resolved.cand.id),
  };
}

async function appendList(candidaturaId: string, section: string, novos: unknown[]) {
  const f = await prisma.candField.findUnique({ where: { candidaturaId_section_key: { candidaturaId, section, key: "linhas" } } });
  const atuais = Array.isArray(f?.value) ? (f!.value as unknown[]) : [];
  const merged = [...atuais, ...novos];
  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section, key: "linhas" } },
    update: { value: merged as object, origin: "intake", state: "por_validar" },
    create: { candidaturaId, section, key: "linhas", value: merged as object, origin: "intake", state: "por_validar" },
  });
}

/**
 * Submete o intake Inovação: grava as respostas e pré-preenche
 * cand_investimentos, cand_tipologias e cand_indicadores (origem='intake',
 * estado='por_validar'). O consultor revê no preview.
 */
export async function submitIntakeInovacao(token: string, answers: IntakeInovacaoAnswers): Promise<boolean> {
  const resolved = await candByToken(token);
  if (!resolved || !resolved.cand) return false;
  const candidaturaId = resolved.cand.id;

  // 1) respostas em bruto (ingredientes p/ geração + histórico)
  await prisma.candField.upsert({
    where: { candidaturaId_section_key: { candidaturaId, section: SEC_INTAKE, key: "respostas" } },
    update: { value: answers as object, origin: "intake", state: "por_validar" },
    create: { candidaturaId, section: SEC_INTAKE, key: "respostas", value: answers as object, origin: "intake", state: "por_validar" },
  });

  // 2) intenções → cand_investimentos (945)
  if (answers.intencoes?.length) {
    await appendList(candidaturaId, "investimentos", answers.intencoes.map((i) => ({
      id: randomUUID(),
      designacao: String(i.designacao ?? "").trim(),
      categoria: i.categoria,
      atividade: null,
      estabelecimento: null,
      dataAquisicao: i.ano ? `${i.ano}-01` : null,
      elegivel: Number(i.montante) || 0,
      ef: false,
    })));
  }

  // 3) tipologias pretendidas → cand_tipologias (955)
  if (answers.tipologias?.length) {
    const validas = answers.tipologias.filter((t) => TIPOLOGIAS.includes(t));
    await appendList(candidaturaId, "tipologia", validas.map((t) => ({ id: randomUUID(), tipo: t, dados: {} })));
  }

  // 4) indicadores-meta → cand_indicadores (956), só os que têm código no catálogo
  const metas = answers.indicadoresMeta ?? {};
  const novosIndic: unknown[] = [];
  for (const [chave, codigo] of Object.entries(META_INDICADOR_CODIGO)) {
    const valor = (metas as unknown as Record<string, number | null>)[chave];
    if (valor == null) continue;
    const cat = await prisma.catalogoIndicador.findUnique({ where: { codigo } });
    if (!cat) continue;
    novosIndic.push({ id: randomUUID(), codigo, valorPre: null, valorMeta: valor, unidade: cat.unidade, fonte: "intake" });
  }
  if (novosIndic.length) await appendList(candidaturaId, "indicadores", novosIndic);

  return true;
}
