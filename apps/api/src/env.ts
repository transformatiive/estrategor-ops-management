import { z } from "zod";

/** Validação das variáveis de ambiente no arranque (falha cedo se faltar algo). */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  SESSION_SECRET: z.string().min(1).default("dev-only-change-me"),
  N8N_CALLBACK_TOKEN: z.string().min(1).default("dev-only-change-me"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
