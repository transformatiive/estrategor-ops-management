import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { buildFinanceiroDTO, seedFromExtraction, updateCell, validateInputs } from "../financial/engine.js";

const cellSchema = z.object({
  mapa: z.enum(["balanco", "dr", "financiamento"]),
  rubrica: z.string().min(1),
  ano: z.number().int(),
  valor: z.number(),
});

/**
 * Componente Financeira (TRNSF-944). Tabelas balanço/DR/financiamento por
 * rubrica × ano: históricos extraídos (validados pelo humano) + totais, rácios
 * e indicadores CALCULADOS em código. Incoerências assinaladas.
 */
export async function financeiroRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  async function candId(projectId: string): Promise<string | null> {
    const cand = await prisma.candidatura.findUnique({ where: { projectId } });
    return cand?.id ?? null;
  }

  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/financeiro", async (req, reply) => {
    const dto = await buildFinanceiroDTO(req.params.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  // Semear a partir da extração (IES/balancetes → rubricas canónicas)
  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/financeiro/seed", async (req, reply) => {
    const id = await candId(req.params.id);
    if (!id) return reply.code(404).send({ error: "Candidatura não iniciada." });
    const ok = await seedFromExtraction(id, req.user!.id);
    if (!ok) return reply.code(409).send({ error: "Sem dados extraídos da IES/balancetes para semear." });
    return buildFinanceiroDTO(req.params.id);
  });

  // Corrigir uma célula de input
  app.patch<{ Params: { id: string } }>("/api/projects/:id/candidatura/financeiro/cell", async (req, reply) => {
    const parsed = cellSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    const id = await candId(req.params.id);
    if (!id) return reply.code(404).send({ error: "Candidatura não iniciada." });
    try {
      const { mapa, rubrica, ano, valor } = parsed.data;
      await updateCell(id, mapa, rubrica, ano, valor, req.user!.id);
      return buildFinanceiroDTO(req.params.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "RUBRICA_COMPUTED") return reply.code(400).send({ error: "Rubrica calculada não é editável." });
      if (msg === "RUBRICA_UNKNOWN") return reply.code(400).send({ error: "Rubrica desconhecida." });
      app.log.error({ err: e }, "Falha ao atualizar célula financeira");
      return reply.code(500).send({ error: "Falha ao gravar." });
    }
  });

  // Validar os inputs históricos (gating dos cálculos finais)
  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/financeiro/validar", async (req, reply) => {
    const id = await candId(req.params.id);
    if (!id) return reply.code(404).send({ error: "Candidatura não iniciada." });
    try {
      await validateInputs(id, req.user!.id);
      return buildFinanceiroDTO(req.params.id);
    } catch {
      return reply.code(409).send({ error: "Sem dados financeiros para validar." });
    }
  });
}
