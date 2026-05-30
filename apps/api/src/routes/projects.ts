import type { FastifyInstance } from "fastify";
import type {
  ChecklistItemDTO,
  ProjectDetailDTO,
  ProjectListItemDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";

/**
 * Endpoints de leitura de projetos (Fase 0 / base do Épico B-01 e B-04).
 * A criação/escrita e a autenticação chegam nos Épicos A e B.
 */
export async function projectRoutes(app: FastifyInstance) {
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
}
