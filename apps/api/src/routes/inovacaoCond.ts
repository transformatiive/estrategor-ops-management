import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import { addSubstituicao, buildInovacaoCondDTO, deleteSubstituicao, updateDescricaoFisica } from "../familiaA/inovacaoCond.js";

const subSchema = z.object({
  produto: z.string().min(1),
  mercadoPais: z.string().nullable().optional(),
  valorImportado: z.number().nullable().optional(),
  producaoNacionalPrevista: z.number().nullable().optional(),
});
const dfSchema = z.object({
  instalacoes: z.string().nullable(),
  areaM2: z.number().nullable(),
  tipologiaConstrutiva: z.string().nullable(),
  notas: z.string().nullable(),
});

/** Inovação — Substituição de importações (A.7) + Descrição física (A.15). */
export async function inovacaoCondRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/inovacao-cond", async (req, reply) => {
    const dto = await buildInovacaoCondDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/substituicao", async (req, reply) => {
    const parsed = subSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try { await addSubstituicao(req.params.id, parsed.data, req.user!.id); return buildInovacaoCondDTO(req.params.id); }
    catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });

  app.delete<{ Params: { id: string; sid: string } }>("/api/projects/:id/candidatura/substituicao/:sid", async (req, reply) => {
    try { await deleteSubstituicao(req.params.id, req.params.sid, req.user!.id); return buildInovacaoCondDTO(req.params.id); }
    catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });

  app.patch<{ Params: { id: string } }>("/api/projects/:id/candidatura/descricao-fisica", async (req, reply) => {
    const parsed = dfSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    try { await updateDescricaoFisica(req.params.id, parsed.data, req.user!.id); return buildInovacaoCondDTO(req.params.id); }
    catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });
}
