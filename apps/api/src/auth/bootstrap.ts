import type { FastifyBaseLogger } from "fastify";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { hashPassword } from "./password.js";

/**
 * Garante o primeiro acesso (TRNSF-934): se não existir nenhum gestor/admin activo
 * e ADMIN_EMAIL/ADMIN_PASSWORD estiverem definidos, cria (ou promove) esse utilizador.
 * Idempotente — seguro a cada arranque.
 */
export async function bootstrapAdmin(log: FastifyBaseLogger): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  const email = env.ADMIN_EMAIL.toLowerCase();

  const managers = await prisma.user.count({
    where: { active: true, role: { in: ["GESTOR", "ADMIN"] } },
  });
  if (managers > 0) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN", active: true, passwordHash: await hashPassword(env.ADMIN_PASSWORD) },
    });
    log.info(`bootstrap: utilizador ${email} promovido a ADMIN.`);
    return;
  }
  await prisma.user.create({
    data: {
      fullName: "Administrador",
      email,
      role: "ADMIN",
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      initials: "AD",
      color: "green",
    },
  });
  log.info(`bootstrap: utilizador ADMIN ${email} criado.`);
}
