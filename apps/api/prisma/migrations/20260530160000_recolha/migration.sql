-- CreateEnum
CREATE TYPE "DocumentOrigin" AS ENUM ('CLIENTE', 'MANUAL');

-- AlterTable: documentos ganham origem, link de recolha e metadados do ficheiro
ALTER TABLE "documents"
  ADD COLUMN "collection_link_id" TEXT,
  ADD COLUMN "mime_type" TEXT,
  ADD COLUMN "size_bytes" INTEGER,
  ADD COLUMN "origin" "DocumentOrigin" NOT NULL DEFAULT 'MANUAL';

-- AlterTable: pedido de recolha ganha tipos pedidos, email do cliente e mensagem
ALTER TABLE "collection_links"
  ADD COLUMN "requested_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "client_email" TEXT,
  ADD COLUMN "message" TEXT;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_collection_link_id_fkey" FOREIGN KEY ("collection_link_id") REFERENCES "collection_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "documents_collection_link_id_idx" ON "documents"("collection_link_id");
