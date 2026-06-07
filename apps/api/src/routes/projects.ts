import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  PROGRAM_CODES,
  CAND_FAMILIES,
  type ChecklistItemDTO,
  type FolderDTO,
  type ProjectDetailDTO,
  type ProjectFoldersDTO,
  type ProjectListItemDTO,
} from "@estrategor/shared";
import { documentTypesForProgram, canManageUsers } from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { provisionProjectFolders } from "../workdrive/provision.js";
import { runPreDiagnostico } from "../prediagnostico/engine.js";

const createProjectSchema = z.object({
  title: z.string().min(1),
  clientName: z.string().min(1),
  clientNif: z.string().optional(),
  program: z.enum(PROGRAM_CODES),
  measureLabel: z.string().optional(),
  responsibleIds: z.array(z.string()).optional(),
});

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  clientName: z.string().min(1).optional(),
  program: z.enum(PROGRAM_CODES).optional(),
  family: z.enum(CAND_FAMILIES).nullable().optional(),
  responsibleIds: z.array(z.string()).optional(),
});

function toFolderDTO(f: {
  id: string;
  path: string;
  name: string;
  parentPath: string | null;
  isRoot: boolean;
  workdriveId: string | null;
  workdriveUrl: string | null;
}): FolderDTO {
  return {
    id: f.id,
    path: f.path,
    name: f.name,
    parentPath: f.parentPath,
    isRoot: f.isRoot,
    workdriveId: f.workdriveId,
    workdriveUrl: f.workdriveUrl,
  };
}

/** Constrói o detalhe de um projeto (Resumo + Milestones). Reutilizado por
 *  GET e pelo PATCH do cabeçalho (TRNSF-1027). */
async function buildProjectDetail(id: string): Promise<ProjectDetailDTO | null> {
  const p = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      program: true,
      responsibles: { include: { user: true } },
      milestones: { orderBy: { order: "asc" } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    code: p.code,
    title: p.title,
    clientName: p.client.name,
    clientNif: p.client.nif,
    program: p.program.code,
    programName: p.program.name,
    state: p.state,
    nextAction: p.nextAction,
    progress: p.progress,
    investmentTotal: p.investmentTotal?.toString() ?? null,
    incentiveValue: p.incentiveValue?.toString() ?? null,
    family: p.family ?? null,
    crmDealId: p.crmDealId ?? null,
    responsibles: p.responsibles.map((r) => ({
      id: r.user.id,
      initials: r.user.initials,
      color: r.user.color,
      fullName: r.user.fullName,
    })),
    milestones: p.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      date: m.date,
      status: m.status,
    })),
  };
}

/**
 * Endpoints de projetos (B-01, B-02, B-04) e pastas WorkDrive (TRNSF-936).
 * Exigem sessão válida.
 */
export async function projectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // B-02 — criar projeto manualmente + provisionar pastas + gerar checklist
  app.post("/api/projects", async (req, reply) => {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const { title, clientName, clientNif, program, measureLabel, responsibleIds } = parsed.data;

    const programRow = await prisma.program.findUnique({ where: { code: program } });
    if (!programRow) return reply.code(400).send({ error: `Programa ${program} não existe.` });

    // código simples e único por ano (placeholder até integração CRM/aviso)
    const year = new Date().getFullYear();
    const seq = (await prisma.project.count()) + 1;
    const code = `${program}-${year}-${String(seq).padStart(4, "0")}`;

    const project = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({ data: { name: clientName, nif: clientNif } });
      const created = await tx.project.create({
        data: {
          code,
          title,
          clientId: client.id,
          programId: programRow.id,
          state: "A0",
          measureLabel: program === "PT2030" ? (measureLabel?.trim() || null) : null,
          responsibles: responsibleIds?.length
            ? { create: responsibleIds.map((userId) => ({ userId })) }
            : undefined,
        },
      });
      // checklist a partir da taxonomia do programa (D-01)
      const docTypes = documentTypesForProgram(program);
      for (const dt of docTypes) {
        const docType = await tx.documentType.findUnique({ where: { key: dt.key } });
        if (docType) {
          await tx.checklistItem.create({
            data: { projectId: created.id, documentTypeId: docType.id, status: "EM_FALTA" },
          });
        }
      }
      await tx.activityLog.create({
        data: { projectId: created.id, userId: req.user!.id, type: "project_create", description: `Criou o projecto ${title}.` },
      });
      return created;
    });

    // provisiona pastas (idempotente); não bloqueia a criação se falhar
    let foldersError: string | null = null;
    try {
      await provisionProjectFolders(project.id, measureLabel);
    } catch (e) {
      foldersError = e instanceof Error ? e.message : String(e);
      app.log.error({ err: e }, "Falha ao provisionar pastas");
    }

    // TRNSF-967 — pré-diagnóstico em segundo plano se o cliente tiver NIF.
    // Não bloqueia a criação; tolerante a falhas.
    if (clientNif?.trim()) {
      runPreDiagnostico(project.id).catch((e) => app.log.error({ err: e }, "pré-diagnóstico falhou"));
    }

    return reply.code(201).send({ id: project.id, code: project.code, foldersError });
  });

  // B-01 — lista de projetos com fase atual
  app.get("/api/projects", async (req) => {
    // RBAC: gestor/admin vê todos; consultor vê só os seus (TRNSF-965/934).
    const isManager = canManageUsers(req.user!.role);
    const projects = await prisma.project.findMany({
      where: isManager ? {} : { responsibles: { some: { userId: req.user!.id } } },
      orderBy: { createdAt: "asc" },
      include: {
        client: true,
        program: true,
        responsibles: { include: { user: true } },
      },
    });

    const items: ProjectListItemDTO[] = projects.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      clientName: p.client.name,
      program: p.program.code,
      state: p.state,
      family: p.family ?? null,
      nextAction: p.nextAction,
      progress: p.progress,
      responsibles: p.responsibles.map((r) => ({
        id: r.user.id,
        initials: r.user.initials,
        color: r.user.color,
        fullName: r.user.fullName,
      })),
    }));
    return items;
  });

  // B-01/B-04 — detalhe de um projeto (drawer + página de projecto): Resumo + Milestones
  app.get<{ Params: { id: string } }>(
    "/api/projects/:id",
    async (req, reply) => {
      const dto = await buildProjectDetail(req.params.id);
      if (!dto) return reply.code(404).send({ error: "Projeto não encontrado" });
      return dto;
    },
  );

  // TRNSF-1027 — editar o cabeçalho do projeto (RBAC: gestor/admin → tudo;
  // consultor → só o responsável, e só em projetos de que é responsável).
  app.patch<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { responsibles: true },
    });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado" });

    const isManager = canManageUsers(req.user!.role);
    const isResponsible = project.responsibles.some((r) => r.userId === req.user!.id);
    if (!isManager && !isResponsible) {
      return reply.code(403).send({ error: "Sem permissão para editar este projeto." });
    }

    const body = parsed.data;
    // Consultor (não gestor) só pode alterar o responsável.
    if (!isManager) {
      const tentaOutros = body.title !== undefined || body.clientName !== undefined || body.program !== undefined || body.family !== undefined;
      if (tentaOutros) {
        return reply.code(403).send({ error: "Só o gestor pode alterar nome, cliente, programa ou família." });
      }
    }

    let programId: string | undefined;
    if (body.program) {
      const programRow = await prisma.program.findUnique({ where: { code: body.program } });
      if (!programRow) return reply.code(400).send({ error: `Programa ${body.program} não existe.` });
      programId = programRow.id;
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: project.id },
        data: {
          ...(body.title !== undefined ? { title: body.title.trim() } : {}),
          ...(programId ? { programId } : {}),
          ...(body.family !== undefined ? { family: (body.family || null) as never } : {}),
        },
      });
      if (body.clientName !== undefined) {
        await tx.client.update({ where: { id: project.clientId }, data: { name: body.clientName.trim() } });
      }
      if (body.responsibleIds !== undefined) {
        await tx.projectResponsible.deleteMany({ where: { projectId: project.id } });
        if (body.responsibleIds.length) {
          await tx.projectResponsible.createMany({
            data: body.responsibleIds.map((userId) => ({ projectId: project.id, userId })),
            skipDuplicates: true,
          });
        }
      }
      await tx.activityLog.create({
        data: { projectId: project.id, userId: req.user!.id, type: "project_update", description: "Atualizou o cabeçalho do projecto." },
      });
    });

    const dto = await buildProjectDetail(project.id);
    return dto;
  });

  // TRNSF-1027 — resumo de dados associados (para avisar antes de apagar).
  app.get<{ Params: { id: string } }>("/api/projects/:id/delete-info", async (req, reply) => {
    if (!canManageUsers(req.user!.role)) return reply.code(403).send({ error: "Sem permissão." });
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado" });
    const [documents, checklist, deadlines, tasks, milestones, candidatura, preDiagnostico] = await Promise.all([
      prisma.document.count({ where: { projectId: project.id } }),
      prisma.checklistItem.count({ where: { projectId: project.id } }),
      prisma.deadline.count({ where: { projectId: project.id } }),
      prisma.task.count({ where: { projectId: project.id } }),
      prisma.milestone.count({ where: { projectId: project.id } }),
      prisma.candidatura.findUnique({ where: { projectId: project.id }, select: { id: true } }),
      prisma.preDiagnostico.findUnique({ where: { projectId: project.id }, select: { projectId: true } }),
    ]);
    const counts = { documents, checklist, deadlines, tasks, milestones, candidatura: !!candidatura, preDiagnostico: !!preDiagnostico };
    const hasData = documents > 0 || checklist > 0 || deadlines > 0 || tasks > 0 || milestones > 0 || !!candidatura || !!preDiagnostico;
    return { ...counts, hasData };
  });

  // TRNSF-1027 — apagar um projeto (só gestor/admin). As relações em cascata
  // removem os dados associados; ActivityLog/Task ficam órfãos (SetNull).
  app.delete<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    if (!canManageUsers(req.user!.role)) {
      return reply.code(403).send({ error: "Só um administrador pode apagar projetos." });
    }
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado" });
    await prisma.project.delete({ where: { id: project.id } });
    return { ok: true };
  });

  // B-04 (base) — checklist documental de um projeto
  app.get<{ Params: { id: string } }>(
    "/api/projects/:id/checklist",
    async (req, reply) => {
      const project = await prisma.project.findUnique({
        where: { id: req.params.id },
      });
      if (!project) return reply.code(404).send({ error: "Projeto não encontrado" });

      const items = await prisma.checklistItem.findMany({
        where: { projectId: req.params.id },
        include: { documentType: true, responsible: true, documents: true },
      });

      const dto: ChecklistItemDTO[] = items.map((it) => ({
        id: it.id,
        documentTypeKey: it.documentType.key,
        documentTypeName: it.documentType.name,
        status: it.status,
        responsible: it.responsible?.fullName ?? null,
        workdriveUrl: it.documents[0]?.workdriveUrl ?? null,
      }));
      return dto;
    },
  );

  // TRNSF-936 — listar a árvore de pastas do projecto (separador Documentos)
  app.get<{ Params: { id: string } }>("/api/projects/:id/folders", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado" });

    const folders = await prisma.folder.findMany({
      where: { projectId: req.params.id },
      orderBy: { path: "asc" },
    });
    const root = folders.find((f) => f.isRoot) ?? null;
    const dto: ProjectFoldersDTO = {
      provisioned: folders.length > 0,
      rootFolderId: root?.workdriveId ?? null,
      folders: folders.map(toFolderDTO),
    };
    return dto;
  });

  // TRNSF-936 — criar/repor a árvore de pastas (idempotente)
  app.post<{ Params: { id: string } }>("/api/projects/:id/folders", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado" });

    try {
      await provisionProjectFolders(req.params.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(502).send({ error: `Falha ao criar pastas no WorkDrive: ${msg}` });
    }
    const folders = await prisma.folder.findMany({
      where: { projectId: req.params.id },
      orderBy: { path: "asc" },
    });
    const root = folders.find((f) => f.isRoot) ?? null;
    const dto: ProjectFoldersDTO = {
      provisioned: folders.length > 0,
      rootFolderId: root?.workdriveId ?? null,
      folders: folders.map(toFolderDTO),
    };
    return dto;
  });
}
