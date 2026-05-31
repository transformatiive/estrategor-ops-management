import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { buildGeracaoDTO, generateField, GenerationError } from "../generation/engine.js";

const gerarSchema = z.object({ docType: z.string().min(1) });

/**
 * Motor de Geração IA dos campos de texto (TRNSF-943). Gera minutas para o
 * consultor refinar; cada campo gerado preenche o núcleo (TRNSF-942) com
 * origem='gerado'. Não gera às cegas: sem aviso/grelha, avisa.
 */
export async function geracaoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Painel de geração: doc_types da família + estado de cada campo
  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/geracao", async (req, reply) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });
    const dto = await buildGeracaoDTO(project.id);
    if (!dto) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return dto;
  });

  // Gerar a minuta de um campo
  app.post<{ Params: { id: string } }>("/api/projects/:id/candidatura/gerar", async (req, reply) => {
    const parsed = gerarSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "docType em falta." });
    try {
      const field = await generateField(req.params.id, parsed.data.docType, req.user!.id);
      return field;
    } catch (e) {
      if (e instanceof GenerationError) {
        const msg = e.message;
        if (msg.startsWith("CONFIG_MISSING:")) {
          return reply.code(409).send({ error: msg.slice("CONFIG_MISSING:".length) });
        }
        const map: Record<string, [number, string]> = {
          DOC_TYPE_UNKNOWN: [400, "Tipo de campo desconhecido."],
          DOC_TYPE_FAMILY_MISMATCH: [400, "Este campo não pertence à família da candidatura."],
          CANDIDATURA_NOT_FOUND: [404, "Candidatura não iniciada."],
        };
        const [code, message] = map[msg] ?? [400, "Não foi possível gerar."];
        return reply.code(code).send({ error: message });
      }
      app.log.error({ err: e }, "Falha ao gerar minuta");
      return reply.code(500).send({ error: "Falha ao gerar a minuta." });
    }
  });
}
