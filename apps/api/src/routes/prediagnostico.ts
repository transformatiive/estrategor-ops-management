import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { buildPreDiagnosticoDTO, runPreDiagnostico, updatePreDiagCampo } from "../prediagnostico/engine.js";

const campoSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
  action: z.enum(["validar", "corrigir"]),
});

/**
 * Pré-diagnóstico assistido por IA (TRNSF-967). Apresentado no Diagnóstico A0;
 * cada campo é validável. Enquanto não validado, NÃO tem efeito no projeto.
 */
export async function prediagnosticoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { id: string } }>("/api/projects/:id/prediagnostico", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
    return buildPreDiagnosticoDTO({ projectId: project.id });
  });

  // Correr (ou recorrer) o pré-diagnóstico em segundo plano
  app.post<{ Params: { id: string } }>("/api/projects/:id/prediagnostico/run", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { client: true } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
    if (!project.client.nif) return reply.code(409).send({ error: "Cliente sem NIF — pré-diagnóstico não aplicável." });
    // não bloqueia: corre em segundo plano
    runPreDiagnostico({ projectId: project.id }).catch((e) => app.log.error({ err: e }, "pré-diagnóstico falhou"));
    return { ok: true, estado: "pendente" };
  });

  // Validar/corrigir um campo (campo a campo)
  app.patch<{ Params: { id: string } }>("/api/projects/:id/prediagnostico/campo", async (req, reply) => {
    const parsed = campoSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    const dto = await updatePreDiagCampo({ projectId: req.params.id }, parsed.data.key, parsed.data.action, parsed.data.value);
    if (!dto) return reply.code(404).send({ error: "Campo ou pré-diagnóstico não encontrado." });
    return dto;
  });

  // ── Rotas paralelas para a Lead (pré-projeto, Lead/Análise) ─────────────────
  // Mesmo motor/DTO; o dono é a lead em vez do projeto.
  app.get<{ Params: { id: string } }>("/api/leads/:id/prediagnostico", async (req, reply) => {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return reply.code(404).send({ error: "Lead não encontrada." });
    return buildPreDiagnosticoDTO({ leadId: lead.id });
  });

  app.post<{ Params: { id: string } }>("/api/leads/:id/prediagnostico/run", async (req, reply) => {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, include: { client: true } });
    if (!lead) return reply.code(404).send({ error: "Lead não encontrada." });
    if (!lead.client.nif) return reply.code(409).send({ error: "Cliente sem NIF — pré-diagnóstico não aplicável." });
    runPreDiagnostico({ leadId: lead.id }).catch((e) => app.log.error({ err: e }, "pré-diagnóstico falhou"));
    return { ok: true, estado: "pendente" };
  });

  app.patch<{ Params: { id: string } }>("/api/leads/:id/prediagnostico/campo", async (req, reply) => {
    const parsed = campoSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    const dto = await updatePreDiagCampo({ leadId: req.params.id }, parsed.data.key, parsed.data.action, parsed.data.value);
    if (!dto) return reply.code(404).send({ error: "Campo ou pré-diagnóstico não encontrado." });
    return dto;
  });
}
