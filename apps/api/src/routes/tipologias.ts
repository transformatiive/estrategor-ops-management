import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import { addTipologia, buildTipologiasDTO, deleteTipologia, updateTipologia } from "../familiaA/tipologias.js";

const dados = z.record(z.union([z.string(), z.number(), z.null()]));
const addSchema = z.object({ tipo: z.enum(["novo_estab", "aumento_capacidade", "diversificacao", "alteracao_processo"]), dados: dados.optional() });
const updateSchema = z.object({ dados });

/** Inovação — Tipologias de investimento (TRNSF-955, secção A.10). */
export async function tipologiasRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/tipologias", async (req, reply) => {
    const dto = await buildTipologiasDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/tipologias", async (req, reply) => {
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try {
      await addTipologia(req.params.id, parsed.data, req.user!.id);
      return buildTipologiasDTO(req.params.id);
    } catch {
      return reply.code(404).send({ error: "Candidatura não iniciada." });
    }
  });

  app.patch<{ Params: { id: string; tid: string } }>("/api/projects/:id/candidatura/tipologias/:tid", async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try {
      await updateTipologia(req.params.id, req.params.tid, parsed.data.dados, req.user!.id);
      return buildTipologiasDTO(req.params.id);
    } catch (e) {
      return reply.code(404).send({ error: (e instanceof Error && e.message === "LINHA_NOT_FOUND") ? "Tipologia não encontrada." : "Candidatura não iniciada." });
    }
  });

  app.delete<{ Params: { id: string; tid: string } }>("/api/projects/:id/candidatura/tipologias/:tid", async (req, reply) => {
    try {
      await deleteTipologia(req.params.id, req.params.tid, req.user!.id);
      return buildTipologiasDTO(req.params.id);
    } catch {
      return reply.code(404).send({ error: "Candidatura não iniciada." });
    }
  });
}
