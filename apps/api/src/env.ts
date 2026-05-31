import { z } from "zod";

/** Validação das variáveis de ambiente no arranque (falha cedo se faltar algo). */
const schema = z.object({
  // Plataformas como o Railway podem injetar NODE_ENV="" (string vazia): nesse
  // caso assumimos "production" (é um deploy); ausente/undefined → "development"
  // (dev local). Sem este preprocess, o Zod rejeitava "" e o servidor crashava
  // no arranque.
  NODE_ENV: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? "production" : v),
    z.enum(["development", "test", "production"]).default("development"),
  ),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  SESSION_SECRET: z.string().min(1).default("dev-only-change-me"),
  N8N_CALLBACK_TOKEN: z.string().min(1).default("dev-only-change-me"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  // URL base público da app (para links de recolha em emails/cron, onde não há
  // request). Se vazio, os links gerados na app derivam do próprio pedido.
  PUBLIC_BASE_URL: z.string().optional(),
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
  // Diretório local onde o adaptador stub guarda os ficheiros carregados (dev/CI).
  WORKDRIVE_STUB_DIR: z.string().default("/tmp/estrategor-workdrive"),
  // Limite de tamanho por ficheiro carregado pelo cliente (bytes). Default 25 MB.
  UPLOAD_MAX_BYTES: z.coerce.number().default(25 * 1024 * 1024),
  // Classificação por IA (TRNSF-938). Sem chave → classificador stub determinístico.
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("anthropic/claude-sonnet-4.6"),
  // Rota de modelo para campos longos/argumentativos (TRNSF-943). Configurável.
  OPENROUTER_MODEL_OPUS: z.string().default("anthropic/claude-opus-4.1"),
  OPENROUTER_BASE: z.string().default("https://openrouter.ai/api/v1"),
  // Email de seguimento (TRNSF-939). Sem SMTP_* → adaptador stub (regista, não envia).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("Estrategor <nao-responder@estrategor.pt>"),
  // Token que protege o endpoint de cron dos lembretes (Railway cron / n8n).
  CRON_TOKEN: z.string().min(1).default("dev-only-change-me"),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
