-- Classificação/Divisão/Arquivo por IA (TRNSF-938): novos campos no documento.
ALTER TABLE "documents"
  ADD COLUMN "proposed_type_id" TEXT,
  ADD COLUMN "confidence_score" DOUBLE PRECISION,
  ADD COLUMN "page_start" INTEGER,
  ADD COLUMN "page_end" INTEGER,
  ADD COLUMN "validated_by_id" TEXT,
  ADD COLUMN "validated_at" TIMESTAMP(3);

-- Documentos pré-938 ficam como já "recebidos"; novos entram "em_analise"
-- (default definido no schema). Atualiza o default da coluna.
ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'em_analise';

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_proposed_type_id_fkey" FOREIGN KEY ("proposed_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");
