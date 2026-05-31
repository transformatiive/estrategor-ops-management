import type { ChecklistStatus } from "./enums.js";

/**
 * Motor de seguimento (TRNSF-939 / spec §9). Rondas de lembrete por pedido de
 * recolha, com intervalos em dias úteis e textos-base.
 */

export interface ReminderRound {
  round: 1 | 2 | 3;
  /** dias úteis após a criação do pedido */
  businessDays: number;
  /** envia cópia ao consultor responsável? */
  ccConsultor: boolean;
}

/** §9 — ronda 1 (T+1), ronda 2 (T+3), ronda 3 (T+5, cópia ao consultor). */
export const REMINDER_ROUNDS: ReminderRound[] = [
  { round: 1, businessDays: 1, ccConsultor: false },
  { round: 2, businessDays: 3, ccConsultor: false },
  { round: 3, businessDays: 5, ccConsultor: true },
];

export const MAX_REMINDER_ROUND = 3;

/** Soma `n` dias úteis (seg–sex) a uma data. */
export function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

/** Conta dias de calendário decorridos entre `from` e `to` (>= 0). */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/** Texto do email de lembrete por ronda (§9). PT-PT. */
export function reminderEmail(opts: {
  round: 1 | 2 | 3;
  projectTitle: string;
  clientName: string;
  link: string;
  missing: string[]; // nomes legíveis dos documentos em falta
}): { subject: string; body: string } {
  const lista = opts.missing.map((m) => `• ${m}`).join("\n");
  if (opts.round === 1) {
    return {
      subject: `Faltam documentos — ${opts.projectTitle}`,
      body:
        `Olá,\n\nFaltam alguns documentos no seu projecto ${opts.projectTitle}. ` +
        `Pode entregá-los aqui: ${opts.link}\n\nObrigado,\nEstrategor`,
    };
  }
  if (opts.round === 2) {
    return {
      subject: `Lembrete: documentos em falta — ${opts.projectTitle}`,
      body:
        `Olá,\n\nReforçamos o pedido de documentos para o projecto ${opts.projectTitle}. ` +
        `Faltam:\n${lista}\n\nEntregue em: ${opts.link}\n\nObrigado,\nEstrategor`,
    };
  }
  return {
    subject: `Urgente: documentos em falta podem atrasar a candidatura — ${opts.projectTitle}`,
    body:
      `Olá,\n\nOs documentos em falta no projecto ${opts.projectTitle} podem ` +
      `comprometer o prazo da candidatura. Faltam:\n${lista}\n\n` +
      `Entregue com urgência em: ${opts.link}\n\n` +
      `(Esta mensagem foi enviada com cópia ao consultor responsável.)\n\nEstrategor`,
  };
}

// ─── DTOs ────────────────────────────────────────────────────────────────

export type ReminderState = "AGENDADO" | "ENVIADO" | "ESCALADO" | "FECHADO";

/** Item da checklist de seguimento (verde/vermelho). */
export interface TrackingItemDTO {
  documentTypeKey: string;
  documentTypeName: string;
  status: ChecklistStatus; // RECEBIDO=verde, EM_FALTA=vermelho, EM_REVISAO=âmbar
  delivered: boolean;
  documentId: string | null;
  workdriveUrl: string | null;
}

/** Resumo de um pedido de recolha + estado dos lembretes (seguimento). */
export interface FollowupDTO {
  collectionLinkId: string;
  status: "ATIVO" | "USADO" | "EXPIRADO";
  clientEmail: string | null;
  missing: string[]; // nomes dos documentos ainda em falta
  reminders: { round: number; scheduledFor: string; sentAt: string | null; state: ReminderState }[];
}

/** Estado do separador Checklist & Seguimento de um projecto. */
export interface ProjectTrackingDTO {
  items: TrackingItemDTO[];
  total: number;
  delivered: number;
  complete: boolean;
  followups: FollowupDTO[];
}

/** Linha de prazo urgente (dashboard + vista Prazos). */
export interface UrgentDeadlineDTO {
  kind: "deadline" | "recolha";
  projectId: string;
  projectTitle: string;
  clientName: string;
  label: string;
  dueDate: string | null;
  daysOverdue: number; // >0 em atraso; <=0 a haver
  severity: "atrasado" | "urgente" | "proximo";
}

export type DeadlineSeverity = "atrasado" | "urgente" | "proximo";

/** Estado de um prazo a partir da data de vencimento. */
export function deadlineSeverity(dueDate: Date, now: Date = new Date()): { severity: DeadlineSeverity; daysOverdue: number } {
  const isPast = dueDate < now;
  if (isPast) return { severity: "atrasado", daysOverdue: daysBetween(dueDate, now) };
  const upcoming = daysBetween(now, dueDate);
  return { severity: upcoming <= 7 ? "urgente" : "proximo", daysOverdue: -upcoming };
}

/** Prazo de um projeto (CRUD na página de projeto). */
export interface DeadlineDTO {
  id: string;
  projectId: string;
  label: string;
  dueDate: string;
  portal: string | null;
  status: string; // pendente | completado
  severity: DeadlineSeverity;
  daysOverdue: number;
}

export interface NovoDeadline {
  label: string;
  dueDate: string; // aaaa-mm-dd
  portal?: string | null;
}

export const DEADLINE_SEVERITY_LABEL: Record<DeadlineSeverity, string> = {
  atrasado: "Em atraso",
  urgente: "Urgente",
  proximo: "Próximo",
};
