-- Permissões (capacidades) por utilizador — fundação RBAC (TRNSF-1056).
-- ADMIN é super-utilizador no código (hasPermission devolve sempre true), pelo
-- que não precisa de backfill; GESTOR recebe os defaults do catálogo; CONSULTOR
-- fica sem permissões.
ALTER TABLE "users" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "users"
SET "permissions" = ARRAY['aprovar_revisao_interna', 'reabrir_projeto', 'gerir_avisos']
WHERE "role" = 'GESTOR';
