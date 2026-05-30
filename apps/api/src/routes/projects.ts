import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  PROGRAM_CODES,
  type ChecklistItemDTO,
  type FolderDTO,
  type ProjectDetailDTO,
  type ProjectFoldersDTO,
  type ProjectListItemDTO,
} from "@estrategor/shared";
import { documentTypesForProgram } from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { provisionProjectFolders } from "../workdrive/provision.js";

const createProjectSchema = z.object({
  title: z.string().min(1),
  clientName: z.string().min(1),
  clientNif: z.string().optional(),
  program: z.enum(PROGRAM_CODES),
  measureLabel: z.string().optional(),
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

    return reply.code(201).send({ id: project.id, code: project.code, foldersError });
  });

  // B-01 — lista de projetos com fase atual
  app.get("/api/projects", async () => {
    const projects = await prisma.project.findMany({
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
      nextAction: p.nextAction,
      progress: p.progress,
      responsibles: p.responsibles.map((r) => ({
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
      const p = await prisma.project.findUnique({
        where: { id: req.params.id },
        include: {
          client: true,
          program: true,
          responsibles: { include: { user: true } },
          milestones: { orderBy: { order: "asc" } },
        },
      });
      if (!p) return reply.code(404).send({ error: "Projeto não encontrado" });

      const dto: ProjectDetailDTO = {
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
        responsibles: p.responsibles.map((r) => ({
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
      return dto;
    },
  );

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
