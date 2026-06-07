import { defineConfig } from "vitest/config";

// Garante as variáveis mínimas para os testes que importam `env.js`
// (ex.: extração de avisos). Não liga a nenhuma base de dados — só satisfaz a
// validação do schema. Respeita valores já definidos (CI/local).
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test",
    },
  },
});
