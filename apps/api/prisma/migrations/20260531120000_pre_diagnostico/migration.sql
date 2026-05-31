-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FieldOrigin" ADD VALUE 'oficial_vies';
ALTER TYPE "FieldOrigin" ADD VALUE 'api_empresas';
ALTER TYPE "FieldOrigin" ADD VALUE 'pre_diagnostico_ia';

-- CreateTable
CREATE TABLE "pre_diagnosticos" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "estado_vies" TEXT NOT NULL DEFAULT 'pendente',
    "estado_api_empresas" TEXT NOT NULL DEFAULT 'pendente',
    "estado_sonar" TEXT NOT NULL DEFAULT 'pendente',
    "estado_sonnet" TEXT NOT NULL DEFAULT 'pendente',
    "campos" JSONB,
    "checklist_a_confirmar" JSONB,
    "fontes_sonar" JSONB,
    "bruto_vies" JSONB,
    "bruto_api_empresas" JSONB,
    "executado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pre_diagnosticos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pre_diagnosticos_project_id_key" ON "pre_diagnosticos"("project_id");

-- AddForeignKey
ALTER TABLE "pre_diagnosticos" ADD CONSTRAINT "pre_diagnosticos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

