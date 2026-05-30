import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { UserDTO } from "@estrategor/shared";
import { prisma } from "../db.js";
import { verifyPassword } from "../auth/password.js";
import {
  createSession,
  destroySession,
  resolveUser,
  setSessionCookie,
} from "../auth/session.js";
import { requireAuth } from "../auth/guards.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function toDTO(u: {
  id: string;
  fullName: string;
  email: string;
  role: UserDTO["role"];
  initials: string;
  color: string;
  active: boolean;
}): UserDTO {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    initials: u.initials,
    color: u.color,
    active: u.active,
  };
}

export async function authRoutes(app: FastifyInstance) {
  // A-01 — login
  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Email e palavra-passe são obrigatórios." });
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    // mensagem genérica para não revelar se o email existe
    const invalid = { error: "Credenciais inválidas." };
    if (!user || !user.active) return reply.code(401).send(invalid);

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return reply.code(401).send(invalid);

    const token = await createSession(user.id);
    setSessionCookie(reply, token);
    await prisma.activityLog.create({
      data: { userId: user.id, type: "login", description: `${user.fullName} iniciou sessão.` },
    });
    return toDTO(user);
  });

  // logout
  app.post("/api/auth/logout", async (req, reply) => {
    await destroySession(req, reply);
    return { ok: true };
  });

  // utilizador da sessão atual
  app.get("/api/auth/me", { preHandler: requireAuth }, async (req) => {
    return toDTO(req.user!);
  });

  // variante sem 401 ruidoso: usado pelo arranque da SPA
  app.get("/api/auth/session", async (req) => {
    const user = await resolveUser(req);
    return user ? toDTO(user) : { user: null };
  });
}
