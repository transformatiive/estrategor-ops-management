import { PrismaClient } from "@prisma/client";

/** Cliente Prisma partilhado (singleton). */
export const prisma = new PrismaClient();
