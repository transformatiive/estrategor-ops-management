import {
  STATE_BADGE_LABEL,
  STATE_TO_FASE,
  type PipelineDTO,
  type ProjectState,
  type RequisitoFase,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { buildGeracaoDTO } from "../generation/engine.js";
import { lastVerificacao } from "../verificacao/engine.js";

/**
 * Calcula o estado do pipeline de um projeto e os pré-requisitos da fase atual
 * ("o que falta para avançar"), em linguagem de cliente (TRNSF-963). Lê a
 * máquina de estados (935), o estado de validação (942) e o Verificador (946).
 */
export async function buildPipelineDTO(projectId: string): Promise<PipelineDTO | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  const state = project.state as ProjectState;
  const faseAtual = STATE_TO_FASE[state] ?? "diagnostico";

  const requisitos: RequisitoFase[] = [];
  let nota: string | null = null;

  if (faseAtual === "diagnostico") {
    const diag = await prisma.diagnostic.findUnique({ where: { projectId } });
    requisitos.push({
      label: "Concluir o diagnóstico de elegibilidade",
      done: !!diag && (diag.result === "ELEGIVEL" || diag.result === "A_REVER"),
    });
  } else if (faseAtual === "recolha") {
    const checklist = await prisma.checklistItem.findMany({ where: { projectId } });
    requisitos.push({
      label: "Recolher os documentos pedidos ao cliente",
      done: checklist.length > 0 && checklist.every((c) => c.status !== "EM_FALTA"),
    });
  } else if (faseAtual === "preparacao") {
    const cand = await prisma.candidatura.findUnique({ where: { projectId } });
    requisitos.push({ label: "Iniciar a candidatura (escolher família)", done: !!cand });
    if (cand) {
      const porValidar = await prisma.candField.count({
        where: { candidaturaId: cand.id, origin: { in: ["extraido", "gerado"] }, state: "por_validar" },
      });
      requisitos.push({ label: "Validar os campos extraídos e gerados", done: porValidar === 0 });

      const ger = await buildGeracaoDTO(projectId);
      const placeholders = (ger?.campos ?? []).reduce((s, c) => s + (c.estado !== null ? c.placeholders : 0), 0);
      requisitos.push({ label: "Resolver os marcadores [A PREENCHER]", done: placeholders === 0 });

      const verif = await lastVerificacao(projectId);
      const erros = verif ? verif.naoConformidades.filter((n) => n.gravidade === "erro").length : null;
      requisitos.push({
        label: "Correr o Verificador sem não-conformidades",
        done: verif?.criadoEm != null && erros === 0,
      });
    }
  } else if (faseAtual === "revisao") {
    const verif = await lastVerificacao(projectId);
    const erros = verif ? verif.naoConformidades.filter((n) => n.gravidade === "erro").length : null;
    requisitos.push({ label: "Revisão interna sem não-conformidades", done: verif?.criadoEm != null && erros === 0 });
    requisitos.push({ label: "MP previsto acima do mínimo do aviso", done: verif?.atingeMinimo === true });
  } else if (faseAtual === "submissao") {
    requisitos.push({ label: "Exportar o pacote e submeter no portal SGO", done: false });
  } else {
    // bloco Execução — só mapa, não trabalhável nesta fase
    nota = "Esta fase faz parte da execução do projeto e fica disponível após a aprovação da candidatura.";
  }

  return { faseAtual, badgeLabel: STATE_BADGE_LABEL[state] ?? faseAtual, requisitos, nota };
}
