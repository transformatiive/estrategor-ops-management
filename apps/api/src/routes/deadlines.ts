import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { deadlineSeverity, type DeadlineDTO } from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";

const createSchema = z.object({
  label: z.string().min(1),
  dueDate: z.string().min(1),
  portal: z.string().nullable().optional(),
});
const updateSchema = z.object({
  label: z.string().min(1).optional(),
  dueDate: z.string().min(1).optional(),
  portal: z.string().nullable().optional(),
  status: z.enum(["pendente", "completado"]).optional(),
});

type DeadlineRow = { id: string; projectId: string; label: string; dueDate: Date; portal: string | null; status: string };

function toDTO(d: DeadlineRow): DeadlineDTO {
  const { severity, daysOverdue } = deadlineSeverity(d.dueDate);
  return {
    id: d.id,
    projectId: d.projectId,
    label: d.label,
    dueDate: d.dueDate.toISOString(),
    portal: d.portal,
    status: d.status,
    severity,
    daysOverdue,
  };
}

/**
 * Prazos do projeto (CRUD). Os prazos passam a ser geríveis na página de
 * projeto e alimentam a vista global de Prazos (GET /api/deadlines/urgent).
 */
export async function deadlinesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/deadlines", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
    const rows = await prisma.deadline.findMany({ where: { projectId: project.id }, orderBy: { dueDate: "asc" } });
    return rows.map((d) => toDTO(d as DeadlineRow));
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/deadlines", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
    const due = new Date(parsed.data.dueDate);
    if (Number.isNaN(due.getTime())) return reply.code(400).send({ error: "Data inválida." });
    const created = await prisma.deadline.create({
      data: { projectId: project.id, label: parsed.data.label.trim(), dueDate: due, portal: parsed.data.portal ?? null, status: "pendente" },
    });
    await prisma.activityLog.create({
      data: { projectId: project.id, userId: req.user!.id, type: "prazo_criado", description: `Prazo adicionado: ${created.label} (${parsed.data.dueDate}).` },
    });
    return reply.code(201).send(toDTO(created as DeadlineRow));
  });

  app.patch<{ Params: { did: string } }>("/api/deadlines/:did", async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    const existing = await prisma.deadline.findUnique({ where: { id: req.params.did } });
    if (!existing) return reply.code(404).send({ error: "Prazo não encontrado." });
    const data: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) data.label = parsed.data.label.trim();
    if (parsed.data.portal !== undefined) data.portal = parsed.data.portal;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.dueDate !== undefined) {
      const due = new Date(parsed.data.dueDate);
      if (Number.isNaN(due.getTime())) return reply.code(400).send({ error: "Data inválida." });
      data.dueDate = due;
    }
    const updated = await prisma.deadline.update({ where: { id: existing.id }, data });
    return toDTO(updated as DeadlineRow);
  });

  app.delete<{ Params: { did: string } }>("/api/deadlines/:did", async (req, reply) => {
    const existing = await prisma.deadline.findUnique({ where: { id: req.params.did } });
    if (!existing) return reply.code(404).send({ error: "Prazo não encontrado." });
    await prisma.deadline.delete({ where: { id: existing.id } });
    return { ok: true };
  });
}
