import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { env } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import { projectRoutes } from "./routes/projects.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { recolhaRoutes } from "./routes/recolha.js";
import { diagnosticoRoutes } from "./routes/diagnostico.js";
import { documentosRoutes } from "./routes/documentos.js";
import { seguimentoRoutes } from "./routes/seguimento.js";
import { candidaturaRoutes } from "./routes/candidatura.js";
import { catalogosRoutes } from "./routes/catalogos.js";
import { extracaoRoutes } from "./routes/extracao.js";
import { geracaoRoutes } from "./routes/geracao.js";
import { financeiroRoutes } from "./routes/financeiro.js";
import { investimentosRoutes } from "./routes/investimentos.js";
import { verificacaoRoutes } from "./routes/verificacao.js";
import { tipologiasRoutes } from "./routes/tipologias.js";
import { atividadesRoutes } from "./routes/atividades.js";
import { inovacaoExtraRoutes } from "./routes/inovacaoExtra.js";
import { inovacaoCondRoutes } from "./routes/inovacaoCond.js";
import { exportacaoRoutes } from "./routes/exportacao.js";
import { intlAcoesRoutes } from "./routes/intlAcoes.js";
import { intlDetalheRoutes } from "./routes/intlDetalhe.js";
import { pipelineRoutes } from "./routes/pipeline.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { deadlinesRoutes } from "./routes/deadlines.js";
import { registerStatic } from "./static.js";

/** Constrói a instância Fastify com plugins e rotas registados. */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(multipart, {
    limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(projectRoutes);
  await app.register(recolhaRoutes);
  await app.register(diagnosticoRoutes);
  await app.register(documentosRoutes);
  await app.register(seguimentoRoutes);
  await app.register(candidaturaRoutes);
  await app.register(catalogosRoutes);
  await app.register(deadlinesRoutes);
  await app.register(extracaoRoutes);
  await app.register(geracaoRoutes);
  await app.register(financeiroRoutes);
  await app.register(investimentosRoutes);
  await app.register(verificacaoRoutes);
  await app.register(tipologiasRoutes);
  await app.register(atividadesRoutes);
  await app.register(inovacaoExtraRoutes);
  await app.register(inovacaoCondRoutes);
  await app.register(exportacaoRoutes);
  await app.register(intlAcoesRoutes);
  await app.register(intlDetalheRoutes);
  await app.register(pipelineRoutes);
  await app.register(dashboardRoutes);

  // SPA (serviço único): serve apps/web/dist + fallback para index.html.
  await registerStatic(app);

  return app;
}
