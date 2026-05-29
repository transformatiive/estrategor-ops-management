import type { FastifyInstance } from "fastify";
import type { HealthDTO } from "@estrategor/shared";
import { prisma } from "../db.js";

/**
 * Health-check para o Railway (Fase 0). Verifica a ligação à base de dados.
 * Responde 200 quando a DB está acessível, 503 caso contrário.
 */
export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_req, reply) => {
    let db: HealthDTO["db"] = "down";
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }

    const body: HealthDTO = {
      status: db === "up" ? "ok" : "degraded",
      db,
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? "0.1.0",
    };
    return reply.code(db === "up" ? 200 : 503).send(body);
  });
}
