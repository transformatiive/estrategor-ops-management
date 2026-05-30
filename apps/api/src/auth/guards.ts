import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@estrategor/shared";
import { canManageUsers } from "@estrategor/shared";
import { resolveUser } from "./session.js";

// Utilizador autenticado anexado ao request.
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  initials: string;
  color: string;
  active: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/** preHandler: exige sessão válida; 401 caso contrário. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const user = await resolveUser(req);
  if (!user) {
    return reply.code(401).send({ error: "Não autenticado" });
  }
  req.user = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    initials: user.initials,
    color: user.color,
    active: user.active,
  };
}

/** preHandler: exige sessão válida E perfil que pode gerir utilizadores. */
export async function requireManager(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (!req.user || !canManageUsers(req.user.role)) {
    return reply.code(403).send({ error: "Sem permissão" });
  }
}
