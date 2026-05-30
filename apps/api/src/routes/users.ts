import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ROLES, canManageUsers, type Role, type UserDTO } from "@estrategor/shared";
import { prisma } from "../db.js";
import { hashPassword } from "../auth/password.js";
import { revokeUserSessions } from "../auth/session.js";
import { requireManager } from "../auth/guards.js";

const roleEnum = z.enum(ROLES);

const createSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  role: roleEnum,
  password: z.string().min(8, "A palavra-passe deve ter pelo menos 8 caracteres."),
});

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: roleEnum.optional(),
  active: z.boolean().optional(),
});

const resetSchema = z.object({
  password: z.string().min(8, "A palavra-passe deve ter pelo menos 8 caracteres."),
});

function initialsFrom(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

function toDTO(u: {
  id: string;
  fullName: string;
  email: string;
  role: Role;
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

/** Nº de gestores/admins activos (para guardas anti-lockout). */
async function activeManagerCount(): Promise<number> {
  return prisma.user.count({
    where: { active: true, role: { in: ["GESTOR", "ADMIN"] } },
  });
}

export async function userRoutes(app: FastifyInstance) {
  // todas as rotas exigem perfil que pode gerir utilizadores
  app.addHook("preHandler", requireManager);

  // A-02 — listar
  app.get("/api/users", async () => {
    const users = await prisma.user.findMany({ orderBy: { fullName: "asc" } });
    return users.map(toDTO);
  });

  // A-02 — criar
  app.post("/api/users", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const { fullName, email, role, password } = parsed.data;
    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return reply.code(409).send({ error: "Já existe um utilizador com esse email." });

    const user = await prisma.user.create({
      data: {
        fullName,
        email: email.toLowerCase(),
        role,
        passwordHash: await hashPassword(password),
        initials: initialsFrom(fullName),
        color: "green",
      },
    });
    await prisma.activityLog.create({
      data: { userId: req.user!.id, type: "user_create", description: `Criou o utilizador ${fullName}.` },
    });
    return reply.code(201).send(toDTO(user));
  });

  // A-02/A-03 — editar (nome, email, papel, estado)
  app.patch<{ Params: { id: string } }>("/api/users/:id", async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return reply.code(404).send({ error: "Utilizador não encontrado." });

    const data = parsed.data;
    const willDeactivate = data.active === false && target.active;
    const willDemote =
      data.role !== undefined && canManageUsers(target.role) && !canManageUsers(data.role);

    // anti-lockout: não desativar/despromover-se a si próprio
    if (req.user!.id === target.id && (willDeactivate || willDemote)) {
      return reply.code(409).send({ error: "Não pode desativar nem despromover a sua própria conta." });
    }
    // anti-lockout: não remover o último gestor/admin activo
    if ((willDeactivate || willDemote) && canManageUsers(target.role) && target.active) {
      if ((await activeManagerCount()) <= 1) {
        return reply.code(409).send({ error: "Tem de existir pelo menos um gestor/admin activo." });
      }
    }

    if (data.email) {
      const other = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
      if (other && other.id !== target.id) {
        return reply.code(409).send({ error: "Já existe um utilizador com esse email." });
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        fullName: data.fullName,
        email: data.email?.toLowerCase(),
        role: data.role,
        active: data.active,
        ...(data.fullName ? { initials: initialsFrom(data.fullName) } : {}),
      },
    });
    // ao desativar, revogar sessões existentes
    if (willDeactivate) await revokeUserSessions(target.id);
    await prisma.activityLog.create({
      data: { userId: req.user!.id, type: "user_update", description: `Editou o utilizador ${updated.fullName}.` },
    });
    return toDTO(updated);
  });

  // A-04 — repor palavra-passe
  app.post<{ Params: { id: string } }>("/api/users/:id/reset-password", async (req, reply) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return reply.code(404).send({ error: "Utilizador não encontrado." });

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    });
    // forçar novo login com a nova palavra-passe
    await revokeUserSessions(target.id);
    await prisma.activityLog.create({
      data: { userId: req.user!.id, type: "password_reset", description: `Repôs a palavra-passe de ${target.fullName}.` },
    });
    return { ok: true };
  });
}
