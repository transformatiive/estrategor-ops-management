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

/** As fases por ordem. A extração corre DENTRO da Recolha (não é um passo). */
export const PIPELINE_FASES: FaseDef[] = [
  { key: "diagnostico", label: "Diagnóstico", bloco: "candidatura" },
  { key: "recolha", label: "Recolha de documentos", bloco: "candidatura" },
  { key: "preparacao", label: "Preparação", bloco: "candidatura" },
  { key: "revisao", label: "Revisão interna", bloco: "candidatura" },
  { key: "submissao", label: "Submissão", bloco: "candidatura" },
  { key: "analise", label: "Análise", bloco: "execucao" },
  { key: "decisao", label: "Decisão", bloco: "execucao" },
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
  B0: "analise",
  B1: "execucao",
  B2: "encerramento",
};

/** Badge de estado em linguagem de cliente (nunca A0–A4). */
export const STATE_BADGE_LABEL: Record<ProjectState, string> = {
  A0: "Diagnóstico",
  A1: "Recolha de documentos",
  A2: "Em preparação da candidatura",
  A3: "Revisão interna",
  A4: "Pronto para submissão",
  B0: "Em análise",
  B1: "Em execução",
  B2: "Encerramento",
};

/** Vistas relevantes a cada fase (chaves dos separadores existentes). */
export const FASE_VISTAS: Record<string, string[]> = {
  diagnostico: ["resumo", "diagnostico"],
  recolha: ["resumo", "recolha", "documentos", "seguimento"],
  preparacao: ["resumo", "candidatura", "extracao", "documentos", "seguimento"],
  revisao: ["resumo", "candidatura", "seguimento"],
  submissao: ["resumo", "candidatura"],
  analise: ["resumo", "milestones", "seguimento"],
  decisao: ["resumo", "milestones", "seguimento"],
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
  recolha: "Recolha",
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
  /** progresso só do bloco candidatura (5 fases) */
  progresso: { concluidas: number; total: number };
}

const faseIndex = (key: string) => PIPELINE_FASES.findIndex((f) => f.key === key);

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
  return { faseAtual: PIPELINE_FASES[cur]?.key ?? "diagnostico", passos, progresso: { concluidas: candidaturaConcluidas, total: 5 } };
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
