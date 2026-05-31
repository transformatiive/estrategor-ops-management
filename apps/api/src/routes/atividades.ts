import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import {
  addAtividade,
  addIndicador,
  buildAtividadesDTO,
  deleteAtividade,
  deleteIndicador,
  suggestIndicadores,
  updateIndicador,
} from "../familiaA/atividades.js";

const atividadeSchema = z.object({ designacao: z.string().min(1) });
const indicadorSchema = z.object({ codigo: z.string().min(1), valorPre: z.number().nullable().optional(), valorMeta: z.number().nullable().optional() });
const updateIndSchema = z.object({ valorPre: z.number().nullable(), valorMeta: z.number().nullable() });

/** Inovação — Atividades de inovação + Indicadores (TRNSF-956, A.11/A.12). */
export async function atividadesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/atividades", async (req, reply) => {
    const dto = await buildAtividadesDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/atividades", async (req, reply) => {
    const parsed = atividadeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try { await addAtividade(req.params.id, parsed.data, req.user!.id); return buildAtividadesDTO(req.params.id); }
    catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });

  app.delete<{ Params: { id: string; aid: string } }>("/api/projects/:id/candidatura/atividades/:aid", async (req, reply) => {
    try { await deleteAtividade(req.params.id, req.params.aid, req.user!.id); return buildAtividadesDTO(req.params.id); }
    catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/indicadores", async (req, reply) => {
    const parsed = indicadorSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try { await addIndicador(req.params.id, parsed.data, req.user!.id); return buildAtividadesDTO(req.params.id); }
    catch (e) { return reply.code(e instanceof Error && e.message === "INDICADOR_UNKNOWN" ? 400 : 404).send({ error: e instanceof Error && e.message === "INDICADOR_UNKNOWN" ? "Indicador fora do catálogo." : "Candidatura não iniciada." }); }
  });

  app.patch<{ Params: { id: string; iid: string } }>("/api/projects/:id/candidatura/indicadores/:iid", async (req, reply) => {
    const parsed = updateIndSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try { await updateIndicador(req.params.id, req.params.iid, parsed.data.valorPre, parsed.data.valorMeta, req.user!.id); return buildAtividadesDTO(req.params.id); }
    catch (e) { return reply.code(404).send({ error: e instanceof Error && e.message === "LINHA_NOT_FOUND" ? "Indicador não encontrado." : "Candidatura não iniciada." }); }
  });

  app.delete<{ Params: { id: string; iid: string } }>("/api/projects/:id/candidatura/indicadores/:iid", async (req, reply) => {
    try { await deleteIndicador(req.params.id, req.params.iid, req.user!.id); return buildAtividadesDTO(req.params.id); }
    catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/indicadores/sugerir", async (req, reply) => {
    try { const n = await suggestIndicadores(req.params.id, req.user!.id); return { ok: true, adicionados: n, ...(await buildAtividadesDTO(req.params.id)) }; }
    catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });
}
