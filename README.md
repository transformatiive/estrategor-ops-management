# Estrategor — Plataforma Operacional

Plataforma web à medida para a gestão de candidaturas a fundos (PT2030). Liga o protótipo
visual existente a um back-end real: recolha documental (Fase A), classificação por IA,
seguimento automático e diagnóstico de elegibilidade (A0).

O spec completo da Semana 1 está em
[`# Estrategor — Plataforma Operacional · .md`](./#%20Estrategor%20—%20Plataforma%20Operacional%20·%20.md).

## Stack

- **Back-end:** Node + TypeScript, [Fastify](https://fastify.dev/), [Prisma](https://www.prisma.io/) sobre **PostgreSQL**.
- **Front-end:** React + Vite + TypeScript + Tailwind (design system portado do protótipo).
- **Fluxos/integrações:** n8n (formulário de recolha, classificação/divisão de documentos, lembretes).
- **IA:** API Claude (leitura/visão/classificação). **Ficheiros:** Zoho WorkDrive.
- **Alojamento + CI/CD:** Railway (deploy a partir de `main`).

## Estrutura (monorepo pnpm)

```
apps/
  api/      Fastify + Prisma (REST, auth, webhooks, callbacks n8n)
  web/      React + Vite (SPA do consultor + futuro formulário do cliente)
packages/
  shared/   tipos/enums/taxonomia partilhados (TS + Zod)
n8n/        exports JSON dos workflows
```

## Desenvolvimento local

Pré-requisitos: Node ≥ 22, pnpm ≥ 10, PostgreSQL (local ou Docker).

```bash
pnpm install
cp .env.example .env          # ajustar DATABASE_URL

# base de dados
pnpm --filter @estrategor/api prisma:migrate     # cria/migra o schema
pnpm --filter @estrategor/api prisma:seed        # dados de exemplo (do protótipo)

# correr API + Web em paralelo
pnpm dev
```

- API: http://localhost:3001 — health-check em `GET /health`.
- Web: http://localhost:5173 (faz proxy de `/api` e `/health` para a API).

## Scripts úteis

| Comando | Efeito |
|---|---|
| `pnpm dev` | API + Web em watch |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes |
| `pnpm test` | testes (Vitest) |
| `pnpm build` | build de todos os pacotes |
| `pnpm --filter @estrategor/api prisma:seed` | popular a DB com dados de exemplo |

## Deploy (Railway)

Três serviços no mesmo projeto Railway:

1. **PostgreSQL** — plugin gerido; injeta `DATABASE_URL`.
2. **api** — usa o [`railway.json`](./railway.json) da raiz: build corre `prisma generate`,
   o arranque corre `prisma migrate deploy` e inicia o servidor; health-check em `/health`.
3. **web** — usa [`apps/web/railway.json`](./apps/web/railway.json): build do Vite + `preview`.

Variáveis de ambiente: ver [`.env.example`](./.env.example). Deploy automático ao fazer
merge em `main`; cada PR corre o [CI](./.github/workflows/ci.yml) (typecheck, testes, build).

## Estado (Semana 1)

- [x] **Fase 0 — Fundação:** monorepo, API + `/health`, schema Prisma + seed, SPA shell, CI, Railway.
- [ ] Épico A — Acesso e Utilizadores
- [ ] Épico B — Base da Aplicação
- [ ] Épico C — Pastas WorkDrive
- [ ] Épico D — Recolha + Formulário
- [ ] Épico E — Classificação/Divisão/Arquivo (IA)
- [ ] Épico F — Rastreio e Seguimento
- [ ] Épico G — A0 Diagnóstico
