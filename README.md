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
pnpm --filter @estrategor/api prisma:seed:ref    # dados de referência (programas, tipos de doc, grelha) — idempotente
pnpm --filter @estrategor/api prisma:seed        # dados de exemplo/demo (utilizadores + projetos do protótipo)

# correr API + Web em paralelo
pnpm dev
```

- API: http://localhost:3001 — health-check em `GET /health`.
- Web: http://localhost:5173 (faz proxy de `/api` e `/health` para a API).

### Acesso (TRNSF-934)

Após o seed, todos os utilizadores de demonstração partilham a palavra-passe
`estrategor2026` (configurável via `SEED_DEMO_PASSWORD`). Exemplos:

- `joana@estrategor.pt` — **Admin** (vê a gestão de utilizadores)
- `tiago@estrategor.pt` — **Gestor**
- `diana@estrategor.pt` — **Consultor** (sem gestão de utilizadores)

Em produção, definir `ADMIN_EMAIL` + `ADMIN_PASSWORD` no Railway: se não existir
nenhum gestor/admin activo, esse utilizador é criado/promovido no arranque.

## Scripts úteis

| Comando | Efeito |
|---|---|
| `pnpm dev` | API + Web em watch |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes |
| `pnpm test` | testes (Vitest) |
| `pnpm build` | build de todos os pacotes |
| `pnpm --filter @estrategor/api prisma:seed:ref` | dados de **referência** (catálogo) — seguro em produção, idempotente |
| `pnpm --filter @estrategor/api prisma:seed` | dados de **demo** (utilizadores + projetos) — só dev |

## Deploy (Railway)

**Serviço único** no projeto Railway (a API serve também a SPA):

1. **PostgreSQL** — plugin gerido; injeta `DATABASE_URL`.
2. **app** — usa o [`railway.json`](./railway.json) da raiz. O build corre `prisma generate`
   e o build da SPA (`apps/web/dist`); o arranque corre `prisma migrate deploy` e inicia o
   servidor Fastify, que serve `/api/*`, `/health` **e** os ficheiros estáticos da SPA
   (com fallback para `index.html` nas rotas do React Router). Health-check em `/health`.

Como API e SPA partilham origem, o frontend usa caminhos relativos (`VITE_API_URL` vazio)
e não há CORS entre domínios. Variáveis de ambiente: ver [`.env.example`](./.env.example).
Deploy automático ao fazer merge em `main`; cada PR corre o
[CI](./.github/workflows/ci.yml) (typecheck, testes, build).

## Estado (Semana 1)

- [x] **Fundação:** monorepo, API + `/health`, schema Prisma + seed, SPA shell, CI, Railway (serviço único: a API serve a SPA).
- [x] **TRNSF‑935 · B — Base da Aplicação:** dados reais (Postgres) na lista e kanban PT2030, drawer de detalhe, página de projecto com separadores.
- [x] **TRNSF‑934 · A — Acesso e Utilizadores:** login (sessão httpOnly server-side), gestão de utilizadores em Configuração, papéis gestor/consultor/admin com RBAC.
- [x] **TRNSF‑936 · C — Pastas no WorkDrive:** provisionamento da árvore de pastas por projecto (adaptador real Zoho + stub), separador *Documentos*.
- [x] **TRNSF‑937 · D — Recolha + Formulário:** separador *Recolha* (link único para N documentos), formulário público do cliente (sem login, upload de PDF/foto), ficheiros na subpasta WorkDrive correta com nome `{Cliente}_{Programa}_{Tipo}_{Data}`, estado por documento.
- [x] **TRNSF‑940/941 · G — A0 Diagnóstico:** separador *Diagnóstico* (condições de acesso como dados por aviso + motor de mérito `GrelhaMerito` configurável), grelha real SICE Qualificação MPr‑2025‑2 semeada, matriz regional A.1, transição A0→Candidatura só com diagnóstico concluído.
- [x] **TRNSF‑938 · E — Classificação/Divisão/Arquivo (IA):** fila de validação no separador *Documentos*; IA (OpenRouter/Claude, com stub sem chave) propõe tipo+confiança, divide PDFs multi-documento, e só arquiva na pasta correcta após confirmação humana.
- [x] **TRNSF‑939 · F — Rastreio e Seguimento:** separador *Checklist & Seguimento* (verde/vermelho por tipo), motor de lembretes por email (rondas T+1/T+3/T+5, §9) via endpoint de cron protegido, vista *Prazos* e bloco 🔴 *Prazos urgentes* (deadlines + recolhas em atraso).
