-- CreateTable
CREATE TABLE "generated_documents" (
    "id" TEXT NOT NULL,
    "candidatura_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "family" "CandFamily" NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "estado" "FieldState" NOT NULL DEFAULT 'por_validar',
    "conteudo" TEXT NOT NULL,
    "data_sources" JSONB,
    "char_limit" INTEGER NOT NULL,
    "char_count" INTEGER NOT NULL,
    "gerado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_by_id" TEXT,
    "validated_at" TIMESTAMP(3),

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_documents_candidatura_id_idx" ON "generated_documents"("candidatura_id");

-- CreateIndex
CREATE INDEX "generated_documents_candidatura_id_doc_type_idx" ON "generated_documents"("candidatura_id", "doc_type");

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

