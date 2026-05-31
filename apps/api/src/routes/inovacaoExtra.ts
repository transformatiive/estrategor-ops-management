import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import { buildInovacaoExtraDTO, updateInovacaoExtra } from "../familiaA/inovacaoExtra.js";

const schema = z.object({
  industria40Ambitos: z.record(z.boolean()).optional(),
  transicaoAmbitos: z.array(z.string()).optional(),
});

/** Inovação — Indústria 4.0 (A.16) + Transição Climática (A.17), TRNSF-957. */
export async function inovacaoExtraRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/inovacao-extra", async (req, reply) => {
    const dto = await buildInovacaoExtraDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  app.patch<{ Params: { id: string } }>("/api/projects/:id/candidatura/inovacao-extra", async (req, reply) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try {
      await updateInovacaoExtra(req.params.id, parsed.data, req.user!.id);
      return buildInovacaoExtraDTO(req.params.id);
    } catch {
      return reply.code(404).send({ error: "Candidatura não iniciada." });
    }
  });
}
