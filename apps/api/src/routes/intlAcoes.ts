import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import { addAcao, buildIntlAcoesDTO, deleteAcao, updateDominio } from "../familiaB/acoes.js";

const domSchema = z.object({ numero: z.number().int(), aplicavel: z.boolean().optional(), contributo: z.string().nullable().optional() });
const acaoSchema = z.object({ dominio: z.number().int(), tipoAcao: z.string().min(1), mercadoPais: z.string().nullable().optional(), ano: z.number().nullable().optional() });

/** Internacionalização — Ações de intervenção + domínios (TRNSF-960). */
export async function intlAcoesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/intl-acoes", async (req, reply) => {
    const dto = await buildIntlAcoesDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  app.patch<{ Params: { id: string } }>("/api/projects/:id/candidatura/intl-dominios", async (req, reply) => {
    const parsed = domSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try { await updateDominio(req.params.id, parsed.data, req.user!.id); return buildIntlAcoesDTO(req.params.id); }
    catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/intl-acoes", async (req, reply) => {
    const parsed = acaoSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try { await addAcao(req.params.id, parsed.data, req.user!.id); return buildIntlAcoesDTO(req.params.id); }
    catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });

  app.delete<{ Params: { id: string; aid: string } }>("/api/projects/:id/candidatura/intl-acoes/:aid", async (req, reply) => {
    try { await deleteAcao(req.params.id, req.params.aid, req.user!.id); return buildIntlAcoesDTO(req.params.id); }
    catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });
}
