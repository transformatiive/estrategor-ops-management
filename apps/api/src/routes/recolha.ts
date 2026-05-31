import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  DOCUMENT_TAXONOMY,
  type CollectionItemDTO,
  type CollectionRequestDTO,
  type ProjectCollectionDTO,
  type PublicCollectionDTO,
} from "@estrategor/shared";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { requireAuth } from "../auth/guards.js";
import { baseUrlFromRequest } from "../lib/baseUrl.js";
import { generateToken, ingestClientUpload } from "../recolha/service.js";
import { scheduleFirstReminder } from "../seguimento/service.js";
import { buildIntakeInovacaoDTO, submitIntakeInovacao } from "../familiaA/intakeInovacao.js";
import { buildIntakeIntlDTO, submitIntakeIntl } from "../familiaB/intakeIntl.js";

const createSchema = z.object({
  documentTypeKeys: z.array(z.string()).min(1, "Escolha pelo menos um documento."),
  clientEmail: z.string().email().optional(),
  message: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

function nameOf(key: string): string {
  return DOCUMENT_TAXONOMY.find((d) => d.key === key)?.name ?? key;
}

function publicUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/recolha/${token}`;
}

/** Constrói o DTO de um pedido de recolha cruzando os tipos pedidos com a checklist. */
async function toRequestDTO(linkId: string, baseUrl: string): Promise<CollectionRequestDTO | null> {
  const link = await prisma.collectionLink.findUnique({
    where: { id: linkId },
    include: { project: true, documents: { include: { documentType: true, proposedType: true } } },
  });
  if (!link) return null;

  // estado por tipo pedido: cruza com checklist_items
  const docTypes = await prisma.documentType.findMany({
    where: { key: { in: link.requestedKeys } },
  });
  const checklist = await prisma.checklistItem.findMany({
    where: { projectId: link.projectId, documentTypeId: { in: docTypes.map((d) => d.id) } },
  });

  const items: CollectionItemDTO[] = link.requestedKeys.map((key) => {
    const dt = docTypes.find((d) => d.key === key);
    const ci = dt ? checklist.find((c) => c.documentTypeId === dt.id) : undefined;
    // mostra o documento validado (tipo confirmado); só na ausência, o proposto
    const doc =
      link.documents.find((d) => d.documentType?.key === key) ??
      link.documents.find((d) => d.proposedType?.key === key);
    return {
      documentTypeKey: key,
      documentTypeName: nameOf(key),
      status: ci?.status ?? "EM_FALTA",
      documentId: doc?.id ?? null,
      fileName: doc?.storedFilename ?? null,
      workdriveUrl: doc?.workdriveUrl ?? null,
    };
  });

  return {
    id: link.id,
    token: link.token,
    url: publicUrl(baseUrl, link.token),
    status: link.status,
    clientEmail: link.clientEmail,
    expiresAt: link.expiresAt.toISOString(),
    createdAt: link.createdAt.toISOString(),
    items,
  };
}

export async function recolhaRoutes(app: FastifyInstance) {
  // ── Endpoints do consultor (exigem sessão) ──

  // D-02 — gerar pedido de recolha (link único) para N tipos de documento
  app.post<{ Params: { id: string } }>(
    "/api/projects/:id/collections",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
      }
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });

      // valida que as keys existem na taxonomia
      const validKeys = parsed.data.documentTypeKeys.filter((k) =>
        DOCUMENT_TAXONOMY.some((d) => d.key === k),
      );
      if (validKeys.length === 0) {
        return reply.code(400).send({ error: "Nenhum tipo de documento válido." });
      }

      const days = parsed.data.expiresInDays ?? 14;
      const link = await prisma.collectionLink.create({
        data: {
          projectId: project.id,
          token: generateToken(),
          requestedKeys: validKeys,
          clientEmail: parsed.data.clientEmail,
          message: parsed.data.message,
          expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
          createdById: req.user!.id,
        },
      });
      await prisma.activityLog.create({
        data: {
          projectId: project.id,
          userId: req.user!.id,
          type: "collection_created",
          description: `Gerou um pedido de recolha (${validKeys.length} documento(s)).`,
        },
      });
      // agenda a 1.ª ronda de lembrete (§9), se houver email do cliente
      await scheduleFirstReminder(link.id);
      return reply.code(201).send(await toRequestDTO(link.id, baseUrlFromRequest(req)));
    },
  );

  // D — listar pedidos de recolha do projecto (separador Recolha)
  app.get<{ Params: { id: string } }>(
    "/api/projects/:id/collections",
    { preHandler: requireAuth },
    async (req, reply) => {
      const project = await prisma.project.findUnique({ where: { id: req.params.id } });
      if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
      const links = await prisma.collectionLink.findMany({
        where: { projectId: req.params.id },
        orderBy: { createdAt: "desc" },
      });
      const baseUrl = baseUrlFromRequest(req);
      const requests = (await Promise.all(links.map((l) => toRequestDTO(l.id, baseUrl)))).filter(
        (r): r is CollectionRequestDTO => r !== null,
      );
      const dto: ProjectCollectionDTO = { requests };
      return dto;
    },
  );

  // ── Endpoints públicos do cliente (sem login) ──

  // D-03 — abrir o formulário público (lista o que falta entregar)
  app.get<{ Params: { token: string } }>("/api/recolha/:token", async (req, reply) => {
    const link = await prisma.collectionLink.findUnique({
      where: { token: req.params.token },
      include: { project: { include: { client: true, program: true } } },
    });
    if (!link) return reply.code(404).send({ error: "Ligação inválida." });

    // "Entregue" = documento validado/arquivado pelo consultor (checklist RECEBIDO),
    // NÃO a proposta da IA por validar. Evita marcar entregue sem confirmação humana.
    const docTypes = await prisma.documentType.findMany({
      where: { key: { in: link.requestedKeys } },
    });
    const checklist = await prisma.checklistItem.findMany({
      where: { projectId: link.projectId, documentTypeId: { in: docTypes.map((d) => d.id) } },
    });
    const receivedTypeIds = new Set(
      checklist.filter((c) => c.status === "RECEBIDO").map((c) => c.documentTypeId),
    );

    const expired = link.status === "EXPIRADO" || link.expiresAt < new Date();
    const status = expired ? "EXPIRADO" : link.status;
    const dto: PublicCollectionDTO = {
      projectTitle: link.project.title,
      clientName: link.project.client.name,
      programCode: link.project.program.code,
      status,
      expiresAt: link.expiresAt.toISOString(),
      items: link.requestedKeys.map((key) => {
        const dt = docTypes.find((d) => d.key === key);
        return {
          documentTypeKey: key,
          documentTypeName: nameOf(key),
          delivered: dt ? receivedTypeIds.has(dt.id) : false,
        };
      }),
    };
    return dto;
  });

  // D-03 — upload de um ficheiro pelo cliente (multipart). O tipo é opcional: o
  // cliente carrega ficheiros e a IA classifica (campo único de upload).
  app.post<{ Params: { token: string }; Querystring: { type?: string } }>(
    "/api/recolha/:token/upload",
    async (req, reply) => {
    const documentTypeKey = req.query.type;

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Nenhum ficheiro enviado." });

    const content = await file.toBuffer();
    if (content.length > env.UPLOAD_MAX_BYTES) {
      return reply.code(413).send({ error: "Ficheiro demasiado grande." });
    }

    try {
      const result = await ingestClientUpload({
        token: req.params.token,
        documentTypeKey,
        originalFilename: file.filename,
        content,
        mimeType: file.mimetype,
      });
      return reply.code(201).send({ ok: true, ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const map: Record<string, [number, string]> = {
        LINK_NOT_FOUND: [404, "Ligação inválida."],
        LINK_EXPIRED: [410, "Ligação expirada."],
        TYPE_NOT_REQUESTED: [400, "Documento não solicitado neste pedido."],
        TYPE_UNKNOWN: [400, "Tipo de documento desconhecido."],
        PROJECT_NOT_FOUND: [404, "Projecto não encontrado."],
        FOLDER_NOT_READY: [502, "Pasta do WorkDrive indisponível."],
      };
      const [code, message] = map[msg] ?? [500, "Falha no upload."];
      if (code >= 500) app.log.error({ err: e }, "Falha no upload de recolha");
      return reply.code(code).send({ error: message });
    }
    },
  );

  // ── Intake diferenciado da família Inovação (TRNSF-959) — público ──

  app.get<{ Params: { token: string } }>("/api/recolha/:token/intake", async (req, reply) => {
    const dto = await buildIntakeInovacaoDTO(req.params.token);
    if (!dto) return reply.code(404).send({ error: "Ligação inválida." });
    return dto;
  });

  app.post<{ Params: { token: string } }>("/api/recolha/:token/intake", async (req, reply) => {
    const parsed = intakeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    const ok = await submitIntakeInovacao(req.params.token, parsed.data);
    if (!ok) return reply.code(409).send({ error: "O ramo Inovação não se aplica a esta candidatura." });
    return { ok: true };
  });

  // ── Intake diferenciado da família Internacionalização (TRNSF-962) — público ──

  app.get<{ Params: { token: string } }>("/api/recolha/:token/intake-intl", async (req, reply) => {
    const dto = await buildIntakeIntlDTO(req.params.token);
    if (!dto) return reply.code(404).send({ error: "Ligação inválida." });
    return dto;
  });

  app.post<{ Params: { token: string } }>("/api/recolha/:token/intake-intl", async (req, reply) => {
    const parsed = intakeIntlSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Dados inválidos." });
    const ok = await submitIntakeIntl(req.params.token, parsed.data);
    if (!ok) return reply.code(409).send({ error: "O ramo Internacionalização não se aplica a esta candidatura." });
    return { ok: true };
  });
}

const intakeIntlSchema = z.object({
  acoes: z.array(z.object({ designacao: z.string(), dominio: z.number().int(), mercadoPais: z.string().nullable(), ano: z.number().nullable() })).default([]),
  mercadosAlvo: z.array(z.string()).default([]),
  rh: z.array(z.object({ funcao: z.string(), custo: z.number().nullable(), periodo: z.string().nullable() })).default([]),
  certificacoes: z.array(z.string()).default([]),
  contexto: z.object({ estrategia: z.string().nullable() }),
});

const intakeSchema = z.object({
  intencoes: z
    .array(z.object({ designacao: z.string(), categoria: z.string(), montante: z.number().nullable(), ano: z.number().nullable() }))
    .default([]),
  tipologias: z.array(z.enum(["novo_estab", "aumento_capacidade", "diversificacao", "alteracao_processo"])).default([]),
  indicadoresMeta: z.object({ emprego: z.number().nullable(), volumeNegocios: z.number().nullable(), capacidade: z.number().nullable() }),
  contexto: z.object({ motivacao: z.string().nullable(), mercadoAlvo: z.string().nullable() }),
});
