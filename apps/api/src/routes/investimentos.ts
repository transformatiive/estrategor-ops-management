import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import {
  addLinha,
  buildInvestimentosDTO,
  buildResumoExecutivo,
  deleteLinha,
  updateLinha,
} from "../investimentos/engine.js";

const linhaSchema = z.object({
  designacao: z.string().min(1),
  categoria: z.string().min(1),
  atividade: z.string().nullable().optional(),
  estabelecimento: z.string().nullable().optional(),
  dataAquisicao: z.string().nullable().optional(),
  elegivel: z.number(),
  ef: z.boolean().optional(),
});

/**
 * Custos / Investimentos + Resumo Executivo (TRNSF-945). Linhas de investimento
 * (origem='intake'), categorias do catálogo, totais e coerência com a
 * componente financeira (TRNSF-944).
 */
export async function investimentosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/investimentos", async (req, reply) => {
    const dto = await buildInvestimentosDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/investimentos", async (req, reply) => {
    const parsed = linhaSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try {
      await addLinha(req.params.id, parsed.data, req.user!.id);
      return buildInvestimentosDTO(req.params.id);
    } catch {
      return reply.code(404).send({ error: "Candidatura não iniciada." });
    }
  });

  app.patch<{ Params: { id: string; linhaId: string } }>(
    "/api/projects/:id/candidatura/investimentos/:linhaId",
    async (req, reply) => {
      const parsed = linhaSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
      try {
        await updateLinha(req.params.id, req.params.linhaId, parsed.data, req.user!.id);
        return buildInvestimentosDTO(req.params.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.code(msg === "LINHA_NOT_FOUND" ? 404 : 404).send({ error: msg === "LINHA_NOT_FOUND" ? "Linha não encontrada." : "Candidatura não iniciada." });
      }
    },
  );

  app.delete<{ Params: { id: string; linhaId: string } }>(
    "/api/projects/:id/candidatura/investimentos/:linhaId",
    async (req, reply) => {
      try {
        await deleteLinha(req.params.id, req.params.linhaId, req.user!.id);
        return buildInvestimentosDTO(req.params.id);
      } catch {
        return reply.code(404).send({ error: "Candidatura não iniciada." });
      }
    },
  );

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/resumo", async (req, reply) => {
    const dto = await buildResumoExecutivo(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });
}
