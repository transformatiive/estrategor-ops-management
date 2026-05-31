import type { FastifyInstance } from "fastify";
import {
  STATE_BADGE_LABEL,
  canManageUsers,
  type ClientDetailDTO,
  type ClientDocumentoDTO,
  type ClientListItemDTO,
  type ClientProjetoDTO,
  type ProjectState,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";

/**
 * Clientes (Configuração). Lista os clientes com projetos em curso e o detalhe
 * no contexto dos projetos + documentação. RBAC: gestor vê todos; consultor vê
 * apenas os clientes dos projetos de que é responsável.
 */
export async function clientRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // filtro de projetos visíveis ao utilizador (igual à lista de projetos)
  function projectScope(userId: string, isManager: boolean) {
    return isManager ? {} : { responsibles: { some: { userId } } };
  }

  app.get("/api/clients", async (req) => {
    const isManager = canManageUsers(req.user!.role);
    const clients = await prisma.client.findMany({
      where: { projects: { some: projectScope(req.user!.id, isManager) } },
      include: {
        projects: { where: projectScope(req.user!.id, isManager), select: { id: true } },
      },
      orderBy: { name: "asc" },
    });
    const out: ClientListItemDTO[] = clients.map((c) => ({
      id: c.id,
      name: c.name,
      sector: c.sector,
      nif: c.nif,
      numProjetos: c.projects.length,
    }));
    return out;
  });

  app.get<{ Params: { id: string } }>("/api/clients/:id", async (req, reply) => {
    const isManager = canManageUsers(req.user!.role);
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        projects: {
          where: projectScope(req.user!.id, isManager),
          include: { program: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!client || client.projects.length === 0) {
      return reply.code(404).send({ error: "Cliente não encontrado." });
    }

    const projetos: ClientProjetoDTO[] = client.projects.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      programCode: p.program.code,
      programName: p.program.name,
      family: p.family ?? null,
      state: p.state as ProjectState,
      badgeLabel: STATE_BADGE_LABEL[p.state as ProjectState] ?? p.state,
      progress: p.progress ?? 0,
    }));

    const projIds = client.projects.map((p) => p.id);
    const titleById = new Map(client.projects.map((p) => [p.id, p.title]));
    const docs = await prisma.document.findMany({
      where: { projectId: { in: projIds }, status: { in: ["arquivado", "a_validar"] } },
      include: { documentType: true },
      orderBy: { createdAt: "desc" },
    });
    const documentos: ClientDocumentoDTO[] = docs.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      projectTitle: titleById.get(d.projectId) ?? "",
      tipo: d.documentType?.name ?? d.originalFilename,
      status: d.status,
      workdriveUrl: d.workdriveUrl,
      createdAt: d.createdAt.toISOString(),
    }));

    const dto: ClientDetailDTO = { id: client.id, name: client.name, nif: client.nif, sector: client.sector, projetos, documentos };
    return dto;
  });
}
