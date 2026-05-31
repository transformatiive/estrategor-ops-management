/**
 * Dashboard de Trabalho (TRNSF-964) — painel por AÇÃO, não por contadores.
 * Agrega o pipeline de cada projeto (TRNSF-963) pela carteira do utilizador e
 * responde a "o que tenho de fazer hoje, em que projeto e porquê?".
 */

export interface DashboardEsperaItem {
  projectId: string;
  code: string;
  title: string;
  familyLabel: string | null;
  faseKey: string;
  faseLabel: string;
  /** o que falta para avançar (pré-requisitos por concluir) */
  oQueFalta: string[];
  /** próximo prazo (ISO), se houver */
  prazo: string | null;
}

export interface DashboardClienteItem {
  projectId: string;
  code: string;
  title: string;
  docsEmFalta: number;
  /** estado do último lembrete ao cliente (ex.: "2.º lembrete enviado") */
  lembrete: string | null;
}

export interface CarteiraFase {
  faseKey: string;
  label: string;
  count: number;
}

export interface DashboardDTO {
  isGestor: boolean;
  /** lista de consultores para o filtro do gestor (null para consultor) */
  consultores: { id: string; nome: string }[] | null;
  resumo: {
    aMinhaEspera: number;
    aguardarCliente: number;
    prazoEstaSemana: number;
    emExecucao: number;
  };
  aMinhaEspera: DashboardEsperaItem[];
  aguardarCliente: DashboardClienteItem[];
  carteiraPorFase: CarteiraFase[];
}

/** Tese do dia para a saudação. */
export function teseDoDia(d: DashboardDTO): string {
  const e = d.resumo.aMinhaEspera;
  const c = d.resumo.aguardarCliente;
  if (e === 0 && c === 0) return "Está tudo em dia — nada à tua espera.";
  const partes: string[] = [];
  if (e > 0) partes.push(`${e} ${e === 1 ? "projeto à tua espera" : "projetos à tua espera"}`);
  if (c > 0) partes.push(`${c} a aguardar o cliente`);
  return `Tens ${partes.join(" e ")}.`;
}
