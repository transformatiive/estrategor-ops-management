-- TRNSF-1068 · item 1 — Fontes de contexto da Preparação para a geração.
-- Aditivo: nova tabela; quando a fonte é um documento guarda o texto extraído.
CREATE TABLE "cand_context_sources" (
    "id" TEXT NOT NULL,
    "candidatura_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "document_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cand_context_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cand_context_sources_candidatura_id_idx" ON "cand_context_sources"("candidatura_id");

-- AddForeignKey
ALTER TABLE "cand_context_sources" ADD CONSTRAINT "cand_context_sources_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cand_context_sources" ADD CONSTRAINT "cand_context_sources_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cand_context_sources" ADD CONSTRAINT "cand_context_sources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
