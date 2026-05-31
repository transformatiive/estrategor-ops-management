-- CreateEnum
CREATE TYPE "CandFamily" AS ENUM ('inovacao_produtiva', 'internacionalizacao', 'qualificacao');

-- CreateEnum
CREATE TYPE "CandStage" AS ENUM ('A2', 'A3', 'A4');

-- CreateEnum
CREATE TYPE "FieldOrigin" AS ENUM ('extraido', 'intake', 'gerado', 'calculado');

-- CreateEnum
CREATE TYPE "FieldState" AS ENUM ('por_validar', 'validado', 'corrigido');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "family" "CandFamily";

-- CreateTable
CREATE TABLE "candidaturas" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "family" "CandFamily" NOT NULL,
    "codigo_aviso" TEXT,
    "medida" TEXT,
    "codigo_projeto_sgo" TEXT,
    "stage" "CandStage" NOT NULL DEFAULT 'A2',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cand_fields" (
    "id" TEXT NOT NULL,
    "candidatura_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "origin" "FieldOrigin" NOT NULL,
    "state" "FieldState" NOT NULL DEFAULT 'por_validar',
    "source_ref" TEXT,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cand_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidaturas_project_id_key" ON "candidaturas"("project_id");

-- CreateIndex
CREATE INDEX "cand_fields_candidatura_id_idx" ON "cand_fields"("candidatura_id");

-- CreateIndex
CREATE INDEX "cand_fields_candidatura_id_section_idx" ON "cand_fields"("candidatura_id", "section");

-- CreateIndex
CREATE UNIQUE INDEX "cand_fields_candidatura_id_section_key_key" ON "cand_fields"("candidatura_id", "section", "key");

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cand_fields" ADD CONSTRAINT "cand_fields_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

