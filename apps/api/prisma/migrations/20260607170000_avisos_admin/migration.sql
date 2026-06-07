-- Catálogo de avisos (TRNSF-1038): auditoria de criação + carimbo de atualização.
-- `updated_at` com default now() para preencher as linhas existentes na aplicação.
ALTER TABLE "merit_grids" ADD COLUMN "created_by_user_id" TEXT;
ALTER TABLE "merit_grids" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "merit_grids"
  ADD CONSTRAINT "merit_grids_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
