-- Recria diagnostics e merit_grids com o esquema do A0/Diagnóstico (TRNSF-940/941).
-- As tabelas anteriores eram stubs vazios — sem dados a preservar.

-- DropTable (stubs antigos)
DROP TABLE IF EXISTS "diagnostics";
DROP TABLE IF EXISTS "merit_grids";

-- CreateTable: grelhas de mérito (dados; chave programa·medida·aviso·regiao·versao)
CREATE TABLE "merit_grids" (
    "id" TEXT NOT NULL,
    "program_code" TEXT NOT NULL,
    "measure" TEXT NOT NULL,
    "codigo_aviso" TEXT NOT NULL,
    "regiao" TEXT,
    "versao" TEXT NOT NULL,
    "fonte_url" TEXT,
    "mp_minimo" DECIMAL(5,2),
    "minimo_por_criterio" DECIMAL(5,2),
    "formula_mp" TEXT,
    "grid" JSONB NOT NULL,
    "access_conditions" JSONB,
    "extracted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merit_grids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merit_grids_program_code_measure_codigo_aviso_regiao_versao_key"
  ON "merit_grids"("program_code", "measure", "codigo_aviso", "regiao", "versao");

-- CreateTable: diagnóstico A0 por projecto
CREATE TABLE "diagnostics" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "conditions" JSONB,
    "regiao" TEXT,
    "merit_inputs" JSONB,
    "merit_breakdown" JSONB,
    "mp" DECIMAL(5,2),
    "merit_grid_id" TEXT,
    "grid_version" TEXT,
    "result" TEXT NOT NULL DEFAULT 'POR_INICIAR',
    "eligible" BOOLEAN,
    "decided_by_user_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diagnostics_project_id_key" ON "diagnostics"("project_id");
CREATE INDEX "diagnostics_project_id_idx" ON "diagnostics"("project_id");

-- AddForeignKey
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_merit_grid_id_fkey" FOREIGN KEY ("merit_grid_id") REFERENCES "merit_grids"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
