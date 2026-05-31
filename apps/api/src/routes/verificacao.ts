import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/guards.js";
import { lastVerificacao, runVerificacao } from "../verificacao/engine.js";

/**
 * Verificador + Cálculo de Mérito (TRNSF-946). "Verificar" devolve
 * não-conformidades nos três eixos (formulário, mérito, coerência) e o MP
 * previsto (determinístico). Sem grelha, avisa em vez de inventar pontuação.
 */
export async function verificacaoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Última verificação (sem correr) — alimenta a vista "Critérios de seleção"
  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/verificacao", async (req, reply) => {
    const dto = await lastVerificacao(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  // Correr a verificação (persiste o resultado)
  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/verificacao", async (req, reply) => {
    const dto = await runVerificacao(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });
}
