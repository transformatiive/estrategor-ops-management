-- CreateEnum
CREATE TYPE "ExtractMethod" AS ENUM ('deterministico', 'ia');

-- CreateTable
CREATE TABLE "extracoes" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "candidatura_id" TEXT NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "metodo" "ExtractMethod" NOT NULL,
    "confianca" DOUBLE PRECISION,
    "campos_extraidos" JSONB NOT NULL,
    "nota" TEXT,
    "estado" "FieldState" NOT NULL DEFAULT 'por_validar',
    "validated_by_id" TEXT,
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extracoes_document_id_key" ON "extracoes"("document_id");

-- CreateIndex
CREATE INDEX "extracoes_candidatura_id_idx" ON "extracoes"("candidatura_id");

-- AddForeignKey
ALTER TABLE "extracoes" ADD CONSTRAINT "extracoes_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracoes" ADD CONSTRAINT "extracoes_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracoes" ADD CONSTRAINT "extracoes_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

