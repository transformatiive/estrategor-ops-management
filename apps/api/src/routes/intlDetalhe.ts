import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import {
  addCusto,
  addDeslocacao,
  addRh,
  buildIntlDetalheDTO,
  deleteCusto,
  deleteDeslocacao,
  deleteRh,
} from "../familiaB/detalhe.js";

const custoSchema = z.object({ acaoId: z.string().min(1), rubrica: z.string().min(1), montante: z.number().nullable().optional(), ano: z.number().nullable().optional() });
const deslSchema = z.object({ acaoId: z.string().min(1), pessoa: z.string().min(1), destino: z.string().nullable().optional(), dias: z.number().nullable().optional(), viagem: z.number().nullable().optional(), estadia: z.number().nullable().optional(), ajudasCusto: z.number().nullable().optional() });
const rhSchema = z.object({ funcao: z.string().min(1), custo: z.number().nullable().optional(), periodo: z.string().nullable().optional() });

/** Internacionalização — Detalhe da ação (custos + deslocações) + RH (TRNSF-961). */
export async function intlDetalheRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/intl-detalhe", async (req, reply) => {
    const dto = await buildIntlDetalheDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  const ok = (req: { params: { id: string } }) => buildIntlDetalheDTO(req.params.id);

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/intl-custos", async (req, reply) => {
    const p = custoSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "Dados inválidos." });
    try { await addCusto(req.params.id, p.data, req.user!.id); return ok(req); } catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });
  app.delete<{ Params: { id: string; cid: string } }>("/api/projects/:id/candidatura/intl-custos/:cid", async (req, reply) => {
    try { await deleteCusto(req.params.id, req.params.cid, req.user!.id); return ok(req); } catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/intl-deslocacoes", async (req, reply) => {
    const p = deslSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "Dados inválidos." });
    try { await addDeslocacao(req.params.id, p.data, req.user!.id); return ok(req); } catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });
  app.delete<{ Params: { id: string; did: string } }>("/api/projects/:id/candidatura/intl-deslocacoes/:did", async (req, reply) => {
    try { await deleteDeslocacao(req.params.id, req.params.did, req.user!.id); return ok(req); } catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/intl-rh", async (req, reply) => {
    const p = rhSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "Dados inválidos." });
    try { await addRh(req.params.id, p.data, req.user!.id); return ok(req); } catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });
  app.delete<{ Params: { id: string; rid: string } }>("/api/projects/:id/candidatura/intl-rh/:rid", async (req, reply) => {
    try { await deleteRh(req.params.id, req.params.rid, req.user!.id); return ok(req); } catch { return reply.code(404).send({ error: "Candidatura não iniciada." }); }
  });
}
