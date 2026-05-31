import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/guards.js";
import { buildDashboard } from "../dashboard/engine.js";

/** Dashboard de Trabalho (TRNSF-964). */
export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Querystring: { consultor?: string } }>("/api/dashboard", async (req) => {
    return buildDashboard({ id: req.user!.id, role: req.user!.role }, req.query.consultor);
  });
}
