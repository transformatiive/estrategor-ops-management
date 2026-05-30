import { z } from "zod";

/** Validação das variáveis de ambiente no arranque (falha cedo se faltar algo). */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  SESSION_SECRET: z.string().min(1).default("dev-only-change-me"),
  N8N_CALLBACK_TOKEN: z.string().min(1).default("dev-only-change-me"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  // Bootstrap do primeiro gestor/admin (TRNSF-934). Em produção definir no Railway.
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  // Validade da sessão (dias).
  SESSION_TTL_DAYS: z.coerce.number().default(7),
  // Zoho WorkDrive (TRNSF-936). Sem estas variáveis, o adaptador corre em modo
  // "stub" (gera IDs fake) — útil em dev/CI/demo sem credenciais Zoho.
  WORKDRIVE_API_BASE: z.string().default("https://www.zohoapis.com/workdrive/api/v1"),
  WORKDRIVE_ACCESS_TOKEN: z.string().optional(),
  WORKDRIVE_REFRESH_TOKEN: z.string().optional(),
  WORKDRIVE_CLIENT_ID: z.string().optional(),
  WORKDRIVE_CLIENT_SECRET: z.string().optional(),
  WORKDRIVE_OAUTH_BASE: z.string().default("https://accounts.zoho.com"),
  // Pasta-raiz (team folder / workspace) onde as pastas de cliente são criadas.
  WORKDRIVE_ROOT_FOLDER_ID: z.string().optional(),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
