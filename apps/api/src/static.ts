import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

// Caminho para o build da SPA (apps/web/dist) a partir de apps/api/src.
const WEB_DIST = fileURLToPath(new URL("../../web/dist", import.meta.url));

/**
 * Serve a SPA (build do Vite) a partir da própria API — serviço único no Railway.
 * - Os ficheiros estáticos são servidos de apps/web/dist.
 * - Pedidos que não sejam /api/* nem /health caem no fallback para index.html
 *   (history API routing do React Router).
 * Se o build da web não existir (ex.: dev sem build), não regista nada — a API
 * continua a responder em /api/* e /health.
 */
export async function registerStatic(app: FastifyInstance): Promise<void> {
  if (!existsSync(WEB_DIST)) {
    app.log.warn(
      `SPA não encontrada em ${WEB_DIST}; a API serve apenas /api/* e /health.`,
    );
    return;
  }

  await app.register(fastifyStatic, {
    root: WEB_DIST,
    wildcard: false, // tratamos o fallback manualmente
  });

  // Fallback SPA: tudo o que não for API/health devolve o index.html.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/") || req.url === "/health") {
      return reply.code(404).send({
        message: `Route ${req.method}:${req.url} not found`,
        error: "Not Found",
        statusCode: 404,
      });
    }
    return reply.sendFile("index.html");
  });

  app.log.info(`SPA servida a partir de ${WEB_DIST}`);
}

export { WEB_DIST };
