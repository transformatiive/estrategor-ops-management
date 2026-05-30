-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('FEITO', 'ATIVO', 'POR_FAZER');

-- AlterEnum
-- Remapeia papéis antigos (ADMIN | PADRAO) para os novos (GESTOR | CONSULTOR | ADMIN).
-- PADRAO -> CONSULTOR; ADMIN mantém-se. O CASE no USING evita falha de cast em dados existentes.
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('GESTOR', 'CONSULTOR', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'PADRAO' THEN 'CONSULTOR'::"Role_new"
    ELSE "role"::text::"Role_new"
  END
);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CONSULTOR';
COMMIT;

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'POR_FAZER',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestones_project_id_idx" ON "milestones"("project_id");

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
