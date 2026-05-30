import type { FastifyRequest } from "fastify";
import { env } from "../env.js";

/**
 * Resolve o URL base público da app para construir ligações partilháveis
 * (ex.: formulário de recolha do cliente).
 *
 * Prioridade:
 *  1. `PUBLIC_BASE_URL` (definido no ambiente) — usar quando há que gerar links
 *     fora do contexto de um pedido (emails/cron).
 *  2. Cabeçalhos do pedido (`x-forwarded-proto`/`host`) — como a API serve a
 *     própria SPA (serviço único), o domínio do pedido é o domínio do cliente.
 *  3. `WEB_ORIGIN` (fallback final, default localhost em dev).
 */
export function baseUrlFromRequest(req: FastifyRequest): string {
  if (env.PUBLIC_BASE_URL) return stripSlash(env.PUBLIC_BASE_URL);

  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ||
    req.protocol ||
    "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() ||
    (req.headers.host as string | undefined);
  if (host) return stripSlash(`${proto}://${host}`);

  return stripSlash(env.WEB_ORIGIN);
}

/** URL base para contextos sem pedido (cron/emails). Usa PUBLIC_BASE_URL ou WEB_ORIGIN. */
export function baseUrlFromEnv(): string {
  return stripSlash(env.PUBLIC_BASE_URL || env.WEB_ORIGIN);
}

function stripSlash(s: string): string {
  return s.replace(/\/$/, "");
}
