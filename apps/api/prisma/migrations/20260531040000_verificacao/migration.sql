-- CreateTable
CREATE TABLE "verificacoes" (
    "id" TEXT NOT NULL,
    "candidatura_id" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "nao_conformidades" JSONB NOT NULL,
    "mp_previsto" DOUBLE PRECISION,
    "mp_por_criterio" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verificacoes_candidatura_id_idx" ON "verificacoes"("candidatura_id");

-- AddForeignKey
ALTER TABLE "verificacoes" ADD CONSTRAINT "verificacoes_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

