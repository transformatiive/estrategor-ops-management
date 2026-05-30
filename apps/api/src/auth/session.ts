import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db.js";
import { env } from "../env.js";

export const SESSION_COOKIE = "estrategor_session";

function expiry(): Date {
  return new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Cria uma sessão na BD e devolve o token (a colocar no cookie). */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { userId, token, expiresAt: expiry() },
  });
  return token;
}

/** Define o cookie httpOnly da sessão. */
export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

/** Remove a sessão (BD + cookie) — logout. */
export async function destroySession(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = req.cookies[SESSION_COOKIE];
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Revoga todas as sessões de um utilizador (ex.: ao desativar). */
export async function revokeUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Resolve o utilizador autenticado a partir do cookie de sessão.
 * Devolve null se não houver sessão válida (ausente, expirada ou inativo).
 */
export async function resolveUser(req: FastifyRequest) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { token } });
    return null;
  }
  if (!session.user.active) return null;
  return session.user;
}
