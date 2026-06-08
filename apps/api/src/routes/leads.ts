import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  PROGRAM_CODES,
  type LeadDTO,
  type LeadEstado,
  type LeadListItemDTO,
  type ProgramCode,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { runPreDiagnostico } from "../prediagnostico/engine.js";
import { createProjectForClient } from "../projects/create.js";

const createLeadSchema = z.object({
  clientId: z.string().min(1).optional(),
  nif: z.string().optional(),
  clientName: z.string().optional(),
  programCode: z.enum(PROGRAM_CODES),
});

const rejeitarSchema = z.object({ motivo: z.string().optional() });

type LeadWithRefs = {
  id: string;
  clientId: string;
  estado: string;
  projectId: string | null;
  createdAt: Date;
  client: { name: string; nif: string | null };
  program: { code: string; name: string };
};

function toListItemDTO(lead: LeadWithRefs): LeadListItemDTO {
  return {
    id: lead.id,
    clientName: lead.client.name,
    clientNif: lead.client.nif,
    programCode: lead.program.code,
    programName: lead.program.name,
    estado: lead.estado as LeadEstado,
    projectId: lead.projectId,
    createdAt: lead.createdAt.toISOString(),
  };
}

function toDetailDTO(lead: LeadWithRefs): LeadDTO {
  return {
    id: lead.id,
    clientId: lead.clientId,
    clientName: lead.client.name,
    clientNif: lead.client.nif,
    programCode: lead.program.code,
    programName: lead.program.name,
    estado: lead.estado as LeadEstado,
    projectId: lead.projectId,
    createdAt: lead.createdAt.toISOString(),
  };
}

const LEAD_INCLUDE = { client: true, program: true } as const;

/**
 * Lead / Análise (pré-projeto). Uma lead qualifica-se antes de existir um Project:
 * corre-se o pré-diagnóstico na lead (mesmo motor) e ao "Qualificar" materializa-se
 * um Project que arranca na fase de Recolha (A1). Aditivo: não altera o fluxo de
 * projetos existente (criados diretamente continuam a arrancar em A0).
 */
export async function leadRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Criar uma lead (cliente existente ou novo por nif/nome) + pré-diagnóstico.
  app.post("/api/leads", async (req, reply) => {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const { clientId, nif, clientName, programCode } = parsed.data;

    const program = await prisma.program.findUnique({ where: { code: programCode } });
    if (!program) return reply.code(404).send({ error: `Programa ${programCode} não existe.` });

    // Resolve o cliente: id explícito → usa; senão por NIF (existente) ou cria novo.
    let client: { id: string; nif: string | null } | null = null;
    if (clientId) {
      client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, nif: true } });
      if (!client) return reply.code(404).send({ error: "Cliente não encontrado." });
    } else {
      const nifTrim = nif?.trim();
      if (nifTrim) {
        client = await prisma.client.findFirst({ where: { nif: nifTrim }, select: { id: true, nif: true } });
      }
      if (!client) {
        const name = clientName?.trim() || (nifTrim ? `NIF ${nifTrim}` : null);
        if (!name) return reply.code(400).send({ error: "Indique o cliente (id, nif ou nome)." });
        client = await prisma.client.create({ data: { name, nif: nifTrim || null }, select: { id: true, nif: true } });
      }
    }

    const lead = await prisma.lead.create({
      data: { clientId: client.id, programId: program.id, estado: "analise" },
      include: LEAD_INCLUDE,
    });

    // Pré-diagnóstico em segundo plano se o cliente tiver NIF (tolerante a falhas).
    if (client.nif?.trim()) {
      runPreDiagnostico({ leadId: lead.id }).catch((e) => app.log.error({ err: e }, "pré-diagnóstico (lead) falhou"));
    }

    return reply.code(201).send(toDetailDTO(lead as LeadWithRefs));
  });

  // Lista de leads (mais recentes primeiro).
  app.get("/api/leads", async () => {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: LEAD_INCLUDE,
    });
    const items: LeadListItemDTO[] = leads.map((l) => toListItemDTO(l as LeadWithRefs));
    return items;
  });

  // Detalhe de uma lead.
  app.get<{ Params: { id: string } }>("/api/leads/:id", async (req, reply) => {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, include: LEAD_INCLUDE });
    if (!lead) return reply.code(404).send({ error: "Lead não encontrada." });
    return toDetailDTO(lead as LeadWithRefs);
  });

  // Qualificar → criar projeto. Materializa um Project na fase de Recolha (A1).
  app.post<{ Params: { id: string } }>("/api/leads/:id/qualificar", async (req, reply) => {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, include: LEAD_INCLUDE });
    if (!lead) return reply.code(404).send({ error: "Lead não encontrada." });
    if (lead.estado !== "analise") {
      return reply.code(409).send({ error: "Só é possível qualificar uma lead em análise." });
    }

    const project = await createProjectForClient(app, {
      clientId: lead.clientId,
      programId: lead.programId,
      programCode: lead.program.code as ProgramCode,
      title: lead.client.name,
      state: "A1",
      userId: req.user!.id,
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { estado: "qualificada", projectId: project.id },
    });

    return reply.code(201).send({ projectId: project.id });
  });

  // Rejeitar uma lead (com motivo opcional).
  app.post<{ Params: { id: string } }>("/api/leads/:id/rejeitar", async (req, reply) => {
    const parsed = rejeitarSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, include: LEAD_INCLUDE });
    if (!lead) return reply.code(404).send({ error: "Lead não encontrada." });
    if (lead.estado === "qualificada") {
      return reply.code(409).send({ error: "Lead já qualificada — não pode ser rejeitada." });
    }

    const motivo = parsed.data.motivo?.trim();
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { estado: "rejeitada" },
      include: LEAD_INCLUDE,
    });

    // ActivityLog (sem projeto: a lead ainda não foi materializada).
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        type: "lead_rejeitada",
        description: `Rejeitou a lead de ${lead.client.name}${motivo ? ` — ${motivo}` : ""}.`,
      },
    });

    return toDetailDTO(updated as LeadWithRefs);
  });
}
