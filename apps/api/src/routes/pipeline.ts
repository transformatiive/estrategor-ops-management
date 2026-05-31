import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/guards.js";
import { buildPipelineDTO } from "../pipeline/engine.js";

/** Vista de Pipeline da página de projeto (TRNSF-963). */
export async function pipelineRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/pipeline", async (req, reply) => {
    const dto = await buildPipelineDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Projeto não encontrado." });
    return dto;
  });
}
