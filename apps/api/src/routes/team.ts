import type { FastifyInstance } from "fastify";
import type { AssignableUserDTO } from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";

/**
 * Utilizadores atribuíveis como responsáveis de projeto. Acessível a qualquer
 * sessão (ao contrário de /api/users, que é só de gestão), para o seletor de
 * responsável na criação de projeto.
 */
export async function teamRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/api/team/assignable", async () => {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    });
    return users as AssignableUserDTO[];
  });
}
