import type { FastifyInstance } from "fastify";
import {
  SEARCH_MIN_CHARS,
  STATE_BADGE_LABEL,
  canManageUsers,
  type ProjectState,
  type SearchResultsDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";

const TAKE = 6;

/**
 * Pesquisa global (topbar). Procura em Projetos, Clientes e Documentos, dentro
 * dos projetos visíveis ao utilizador (gestor: todos; consultor: os seus).
 */
export async function searchRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Querystring: { q?: string } }>("/api/search", async (req) => {
    const q = (req.query.q ?? "").trim();
    const empty: SearchResultsDTO = { projetos: [], clientes: [], documentos: [], total: 0 };
    if (q.length < SEARCH_MIN_CHARS) return empty;

    const isManager = canManageUsers(req.user!.role);
    const scope = isManager ? {} : { responsibles: { some: { userId: req.user!.id } } };
    const like = { contains: q, mode: "insensitive" as const };

    const [projetos, clientes, documentos] = await Promise.all([
      prisma.project.findMany({
        where: {
          AND: [
            scope,
            { OR: [{ title: like }, { code: like }, { measureLabel: like }, { client: { name: like } }] },
          ],
        },
        include: { client: true },
        take: TAKE,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.client.findMany({
        where: { AND: [{ projects: { some: scope } }, { OR: [{ name: like }, { nif: like }] }] },
        take: TAKE,
        orderBy: { name: "asc" },
      }),
      prisma.document.findMany({
        where: {
          AND: [
            { project: scope },
            { status: { in: ["arquivado", "a_validar"] } },
            { OR: [{ originalFilename: like }, { storedFilename: like }, { documentType: { name: like } }] },
          ],
        },
        include: { documentType: true, project: true },
        take: TAKE,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const dto: SearchResultsDTO = {
      projetos: projetos.map((p) => ({
        id: p.id,
        title: p.title,
        code: p.code,
        clientName: p.client.name,
        badgeLabel: STATE_BADGE_LABEL[p.state as ProjectState] ?? p.state,
      })),
      clientes: clientes.map((c) => ({ id: c.id, name: c.name, sector: c.sector })),
      documentos: documentos.map((d) => ({
        id: d.id,
        projectId: d.projectId,
        projectTitle: d.project.title,
        tipo: d.documentType?.name ?? d.originalFilename,
        status: d.status,
      })),
      total: 0,
    };
    dto.total = dto.projetos.length + dto.clientes.length + dto.documentos.length;
    return dto;
  });
}
