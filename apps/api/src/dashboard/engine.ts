import {
  CAND_FAMILY_LABELS,
  PIPELINE_FASES,
  canManageUsers,
  type CarteiraFase,
  type DashboardClienteItem,
  type DashboardDTO,
  type DashboardEsperaItem,
  type Role,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { buildPipelineDTO } from "../pipeline/engine.js";

const candidaturaFases = PIPELINE_FASES.filter((f) => f.bloco === "candidatura");
const faseBloco = (key: string) => PIPELINE_FASES.find((f) => f.key === key)?.bloco ?? "candidatura";

/** Estado legível do último lembrete de um pedido de recolha. */
function lembreteLabel(reminders: { attemptNo: number; status: string; sentAt: Date | null }[]): string | null {
  const enviados = reminders.filter((r) => r.sentAt).sort((a, b) => b.attemptNo - a.attemptNo);
  const last = enviados[0];
  if (!last) return null;
  const ord = `${last.attemptNo}.º lembrete`;
  return last.status === "ESCALADO" ? `${ord} — escalado` : `${ord} enviado`;
}

/**
 * Constrói o Dashboard de Trabalho para o utilizador (TRNSF-964). Consultor vê
 * só os seus projetos; gestor/admin vê todos (com filtro opcional por consultor).
 */
export async function buildDashboard(
  user: { id: string; role: Role },
  consultorFilter?: string,
): Promise<DashboardDTO> {
  const isGestor = canManageUsers(user.role);

  const where = isGestor
    ? consultorFilter
      ? { responsibles: { some: { userId: consultorFilter } } }
      : {}
    : { responsibles: { some: { userId: user.id } } };

  const projects = await prisma.project.findMany({
    where,
    include: { responsibles: true },
    orderBy: { updatedAt: "desc" },
  });

  const aMinhaEspera: DashboardEsperaItem[] = [];
  const aguardarCliente: DashboardClienteItem[] = [];
  const carteira = new Map<string, number>(candidaturaFases.map((f) => [f.key, 0]));
  let emExecucao = 0;
  let prazoEstaSemana = 0;

  const limiteSemana = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  for (const p of projects) {
    const pipe = await buildPipelineDTO(p.id);
    if (!pipe) continue;
    const fase = pipe.faseAtual;
    const bloco = faseBloco(fase);

    // prazo desta semana (deadline pendente nos próximos 7 dias)
    const prox = await prisma.deadline.findFirst({
      where: { projectId: p.id, status: { not: "concluido" }, dueDate: { lte: limiteSemana } },
      orderBy: { dueDate: "asc" },
    });
    if (prox) prazoEstaSemana += 1;

    if (bloco === "execucao") {
      emExecucao += 1;
      continue;
    }
    carteira.set(fase, (carteira.get(fase) ?? 0) + 1);

    const cand = await prisma.candidatura.findUnique({ where: { projectId: p.id } });
    const familyLabel = cand ? CAND_FAMILY_LABELS[cand.family] : null;

    if (fase === "recolha") {
      const docsEmFalta = await prisma.checklistItem.count({ where: { projectId: p.id, status: "EM_FALTA" } });
      if (docsEmFalta > 0) {
        const link = await prisma.collectionLink.findFirst({
          where: { projectId: p.id, status: "ATIVO" },
          include: { reminders: true },
          orderBy: { createdAt: "desc" },
        });
        aguardarCliente.push({
          projectId: p.id,
          code: p.code,
          title: p.title,
          docsEmFalta,
          lembrete: link ? lembreteLabel(link.reminders) : null,
        });
      }
    } else {
      const undone = pipe.requisitos.filter((r) => !r.done).map((r) => r.label);
      if (undone.length > 0) {
        aMinhaEspera.push({
          projectId: p.id,
          code: p.code,
          title: p.title,
          familyLabel,
          faseKey: fase,
          faseLabel: pipe.badgeLabel,
          oQueFalta: undone,
          prazo: prox?.dueDate.toISOString() ?? null,
        });
      }
    }
  }

  const carteiraPorFase: CarteiraFase[] = candidaturaFases.map((f) => ({
    faseKey: f.key,
    label: f.label,
    count: carteira.get(f.key) ?? 0,
  }));

  let consultores: { id: string; nome: string }[] | null = null;
  if (isGestor) {
    const us = await prisma.user.findMany({ where: { active: true, role: "CONSULTOR" }, orderBy: { fullName: "asc" } });
    consultores = us.map((u) => ({ id: u.id, nome: u.fullName }));
  }

  return {
    isGestor,
    consultores,
    resumo: {
      aMinhaEspera: aMinhaEspera.length,
      aguardarCliente: aguardarCliente.length,
      prazoEstaSemana,
      emExecucao,
    },
    aMinhaEspera,
    aguardarCliente,
    carteiraPorFase,
  };
}
