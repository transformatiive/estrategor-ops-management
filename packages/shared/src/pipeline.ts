/**
 * Vista de Pipeline da página de projeto (TRNSF-963).
 *
 * Representa a máquina de estados (TRNSF-935) em LINGUAGEM DE CLIENTE — os
 * códigos A0–A4/B* e "Fase A/B" nunca aparecem na interface. Dois blocos
 * contínuos: Candidatura (trabalhável) e Execução (mapa, "se aprovado").
 */

import type { ProjectState } from "./enums.js";

export type PipelineBloco = "candidatura" | "execucao";
export type FaseEstado = "concluido" | "em_curso" | "por_iniciar" | "execucao";

export interface FaseDef {
  key: string;
  label: string;
  bloco: PipelineBloco;
}

/**
 * As fases por ordem. A extração corre DENTRO da Recolha (não é um passo).
 *
 * TRNSF-1067 · 2b: a Análise e as Alegações contrárias passaram para o bloco
 * Candidatura; a "Decisão" deixou de ser uma fase (é o gate entre a Análise e a
 * Execução/Alegações); a Execução arranca no Termo de aceitação.
 */
export const PIPELINE_FASES: FaseDef[] = [
  { key: "diagnostico", label: "Diagnóstico", bloco: "candidatura" },
  { key: "recolha", label: "Recolha de documentos", bloco: "candidatura" },
  { key: "preparacao", label: "Preparação", bloco: "candidatura" },
  { key: "revisao", label: "Revisão interna", bloco: "candidatura" },
  { key: "submissao", label: "Submissão", bloco: "candidatura" },
  { key: "analise", label: "Análise", bloco: "candidatura" },
  { key: "alegacoes", label: "Alegações contrárias", bloco: "candidatura" },
  { key: "termo", label: "Termo de aceitação", bloco: "execucao" },
  { key: "execucao", label: "Execução", bloco: "execucao" },
  { key: "encerramento", label: "Encerramento", bloco: "execucao" },
];

/** Estado interno (máquina de estados) → fase do pipeline. */
export const STATE_TO_FASE: Record<ProjectState, string> = {
  A0: "diagnostico",
  A1: "recolha",
  A2: "preparacao",
  A3: "revisao",
  A4: "submissao",
  A5: "analise",
  A6: "alegacoes",
  B0: "termo",
  B1: "execucao",
  B2: "encerramento",
  // Terminal "Não prosseguiu" (TRNSF-1044): congela na fase do diagnóstico.
  ENCERRADO: "diagnostico",
};

/** Badge de estado em linguagem de cliente (nunca A0–A6/B*). */
export const STATE_BADGE_LABEL: Record<ProjectState, string> = {
  A0: "Diagnóstico",
  A1: "Recolha de documentos",
  A2: "Em preparação da candidatura",
  A3: "Revisão interna",
  A4: "Pronto para submissão",
  A5: "Em análise",
  A6: "Alegações contrárias",
  B0: "Termo de aceitação",
  B1: "Em execução",
  B2: "Encerramento",
  ENCERRADO: "Não prosseguiu",
};

/** Vistas relevantes a cada fase (chaves dos separadores existentes). */
export const FASE_VISTAS: Record<string, string[]> = {
  diagnostico: ["resumo", "diagnostico"],
  // TRNSF-1050 — o separador "Recolha" foi fundido em "Checklist & Seguimento":
  // pedir documentos (gerar ligação) + estado por cores + lembretes num só lugar.
  recolha: ["resumo", "documentos", "seguimento"],
  preparacao: ["resumo", "candidatura", "extracao", "documentos", "seguimento"],
  revisao: ["resumo", "candidatura", "seguimento"],
  submissao: ["resumo", "candidatura"],
  // Cauda da Candidatura (TRNSF-1067): em Análise consulta-se a candidatura
  // submetida e acompanha-se o pedido de elementos; nas Alegações há novos
  // documentos e escrita.
  analise: ["resumo", "candidatura", "seguimento", "milestones"],
  alegacoes: ["resumo", "candidatura", "documentos", "seguimento"],
  termo: ["resumo", "milestones", "seguimento"],
  execucao: ["resumo", "milestones", "seguimento"],
  encerramento: ["resumo", "milestones", "seguimento"],
};

/** Rótulos das vistas em linguagem de cliente. */
export const VISTA_LABELS: Record<string, string> = {
  resumo: "Resumo",
  milestones: "Milestones",
  diagnostico: "Diagnóstico",
  candidatura: "Candidatura",
  extracao: "Extração",
  documentos: "Documentos",
  seguimento: "Checklist & Seguimento",
};

export interface FasePasso extends FaseDef {
  estado: FaseEstado;
  numero: number;
}

export interface PipelineView {
  faseAtual: string;
  passos: FasePasso[];
  /** progresso só do bloco candidatura */
  progresso: { concluidas: number; total: number };
}

const faseIndex = (key: string) => PIPELINE_FASES.findIndex((f) => f.key === key);

/** Nº total de fases do bloco Candidatura (denominador do progresso). */
const CANDIDATURA_TOTAL = PIPELINE_FASES.filter((f) => f.bloco === "candidatura").length;

/** Deriva os estados de cada passo a partir da fase atual (puro, sem BD). */
export function computePipeline(faseAtual: string): PipelineView {
  const cur = Math.max(0, faseIndex(faseAtual));
  const curBloco = PIPELINE_FASES[cur]?.bloco ?? "candidatura";

  const passos: FasePasso[] = PIPELINE_FASES.map((f, i) => {
    let estado: FaseEstado;
    if (i < cur) estado = "concluido";
    else if (i === cur) estado = "em_curso";
    else if (f.bloco === "execucao" && curBloco === "candidatura") estado = "execucao";
    else estado = "por_iniciar";
    return { ...f, estado, numero: i + 1 };
  });

  const candidaturaConcluidas = passos.filter((p) => p.bloco === "candidatura" && p.estado === "concluido").length;
  return { faseAtual: PIPELINE_FASES[cur]?.key ?? "diagnostico", passos, progresso: { concluidas: candidaturaConcluidas, total: CANDIDATURA_TOTAL } };
}

export function vistasDaFase(faseKey: string): string[] {
  return FASE_VISTAS[faseKey] ?? ["resumo"];
}

// ─── Bloco "o que falta para avançar" (preenchido pela API) ───────────────

export interface RequisitoFase {
  label: string;
  done: boolean;
}

export interface PipelineDTO {
  faseAtual: string;
  badgeLabel: string;
  requisitos: RequisitoFase[];
  /** mensagem quando a fase não é trabalhável (bloco Execução) */
  nota: string | null;
}
