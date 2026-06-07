import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/guards.js";
import { buildExport, exportStatus, mimeFor, type ExportFormat } from "../export/engine.js";
import { contentDisposition } from "../util/headers.js";

const FORMATS: ExportFormat[] = ["xlsx", "docx", "pdf"];

/**
 * Exportação estruturada da candidatura (TRNSF-954): Excel (tabelas), Word
 * (textos) e PDF (vista consolidada + relatório do Verificador). Os ficheiros
 * são guardados na subpasta Candidatura do WorkDrive e devolvidos para download.
 */
export async function exportacaoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // verificação leve antes de exportar (campos por validar / [A PREENCHER])
  app.get<{ Params: { id: string } }>("/api/projects/:id/candidatura/export/status", async (req, reply) => {
    const status = await exportStatus(req.params.id);
    if (!status) return reply.code(404).send({ error: "Candidatura não iniciada." });
    return status;
  });

  // gera e devolve o ficheiro do formato pedido
  app.get<{ Params: { id: string; format: string } }>("/api/projects/:id/candidatura/export/:format", async (req, reply) => {
    const format = req.params.format as ExportFormat;
    if (!FORMATS.includes(format)) return reply.code(400).send({ error: "Formato inválido (xlsx, docx ou pdf)." });
    try {
      const result = await buildExport(req.params.id, format);
      if (!result) return reply.code(404).send({ error: "Candidatura não iniciada." });
      reply.header("Content-Type", mimeFor(format));
      reply.header("Content-Disposition", contentDisposition(result.filename, "attachment"));
      return reply.send(result.buffer);
    } catch (e) {
      app.log.error({ err: e }, "Falha ao exportar candidatura");
      return reply.code(500).send({ error: "Falha ao gerar o ficheiro." });
    }
  });
}
