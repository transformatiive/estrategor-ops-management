-- TRNSF-1046: armazenamento dos bytes do ficheiro na BD (por agora)
CREATE TABLE "document_blobs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_blobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_blobs_document_id_key" ON "document_blobs"("document_id");

ALTER TABLE "document_blobs" ADD CONSTRAINT "document_blobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
