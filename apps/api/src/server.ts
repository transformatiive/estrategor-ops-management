import { buildApp } from "./app.js";
import { env } from "./env.js";
import { prisma } from "./db.js";

async function main() {
  const app = await buildApp();

  const close = async () => {
    app.log.info("A encerrar…");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);

  try {
    // 0.0.0.0 para o Railway expor o serviço
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
