import type { FastifyInstance } from "fastify";
import { documentTypesForProgram, type ProgramCode, type ProjectState } from "@estrategor/shared";
import { prisma } from "../db.js";
import { provisionProjectFolders } from "../workdrive/provision.js";

/**
 * Cria um Project para um cliente/programa já existentes, replicando o fluxo de
 * `POST /api/projects`: código único, checklist a partir da taxonomia, ActivityLog
 * e provisionamento de pastas (não bloqueante). Extraído para ser reutilizado pela
 * qualificação de uma Lead (Lead/Análise), que materializa um projeto na fase de
 * Recolha (A1).
 */
export async function createProjectForClient(
  app: FastifyInstance,
  opts: {
    clientId: string;
    programId: string;
    programCode: ProgramCode;
    title: string;
    state: ProjectState;
    userId?: string;
    measureLabel?: string | null;
  },
): Promise<{ id: string; code: string; foldersError: string | null }> {
  const { clientId, programId, programCode, title, state, userId, measureLabel } = opts;

  // código simples e único por ano (placeholder até integração CRM/aviso)
  const year = new Date().getFullYear();
  const seq = (await prisma.project.count()) + 1;
  const code = `${programCode}-${year}-${String(seq).padStart(4, "0")}`;

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        code,
        title,
        clientId,
        programId,
        state,
        measureLabel: programCode === "PT2030" ? (measureLabel?.trim() || null) : null,
      },
    });
    // checklist a partir da taxonomia do programa (D-01)
    const docTypes = documentTypesForProgram(programCode);
    for (const dt of docTypes) {
      const docType = await tx.documentType.findUnique({ where: { key: dt.key } });
      if (docType) {
        await tx.checklistItem.create({
          data: { projectId: created.id, documentTypeId: docType.id, status: "EM_FALTA" },
        });
      }
    }
    await tx.activityLog.create({
      data: { projectId: created.id, userId, type: "project_create", description: `Criou o projecto ${title}.` },
    });
    return created;
  });

  // provisiona pastas (idempotente); não bloqueia a criação se falhar
  let foldersError: string | null = null;
  try {
    await provisionProjectFolders(project.id, measureLabel ?? undefined);
  } catch (e) {
    foldersError = e instanceof Error ? e.message : String(e);
    app.log.error({ err: e }, "Falha ao provisionar pastas");
  }

  return { id: project.id, code: project.code, foldersError };
}
