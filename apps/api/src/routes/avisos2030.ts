import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { canManageUsers, hasPermission } from "@estrategor/shared";
import { requireAuth } from "../auth/guards.js";
import { env } from "../env.js";
import { buildGridsForOpenAvisos, listOpenAvisos2030 } from "../avisos2030/build.js";

function cronAutorizado(req: FastifyRequest): boolean {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-cron-token"] as string | undefined);
  return token === env.CRON_TOKEN;
}

function exigeAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  const u = req.user;
  if (!u || (!canManageUsers(u.role) && !hasPermission(u, "gerir_avisos"))) {
    reply.code(403).send({ error: "Só um administrador pode sincronizar os avisos." });
    return false;
  }
  return true;
}

const parseLimit = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 100) : 10;
};

/**
 * Sincronização dos avisos PT2030 (TRNSF-1072 · F1+F3). Cron protegido por token
 * (Railway) para correr à noite; trigger/lista para admin (testes e operação).
 */
export async function avisos2030Routes(app: FastifyInstance): Promise<void> {
  // ── Cron (token, sem sessão): construir grelhas dos avisos abertos ──
  app.post("/api/cron/avisos/grids", async (req, reply) => {
    if (!cronAutorizado(req)) return reply.code(401).send({ error: "Token de cron inválido." });
    const limit = parseLimit((req.query as { limit?: string })?.limit);
    const res = await buildGridsForOpenAvisos({ limit });
    return { ok: true, ...res };
  });

  // ── Admin (sessão) ──
  app.register(async (priv) => {
    priv.addHook("preHandler", requireAuth);

    // Lista dos avisos abertos no portal (resumo) — sem construir nada.
    priv.get("/api/avisos/2030", async (req, reply) => {
      if (!exigeAdmin(req, reply)) return;
      const avisos = await listOpenAvisos2030();
      return { total: avisos.length, avisos };
    });

    // Trigger manual da construção de grelhas (para testar/operar).
    priv.post("/api/avisos/2030/build", async (req, reply) => {
      if (!exigeAdmin(req, reply)) return;
      const limit = parseLimit((req.query as { limit?: string })?.limit);
      const res = await buildGridsForOpenAvisos({ limit });
      return { ok: true, ...res };
    });
  });
}
