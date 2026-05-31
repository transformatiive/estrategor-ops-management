-- CreateTable
CREATE TABLE "catalogo_cae" (
    "codigo" TEXT NOT NULL,
    "designacao" TEXT NOT NULL,

    CONSTRAINT "catalogo_cae_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "catalogo_geo" (
    "id" TEXT NOT NULL,
    "nuts2" TEXT NOT NULL,
    "nuts3" TEXT NOT NULL,
    "concelho" TEXT NOT NULL,
    "freguesia" TEXT,
    "baixa_densidade" BOOLEAN NOT NULL DEFAULT false,
    "regiao_programa" TEXT,

    CONSTRAINT "catalogo_geo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogo_pais" (
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "catalogo_pais_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "catalogo_rubrica_snc" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "designacao" TEXT NOT NULL,
    "vida_util" INTEGER,

    CONSTRAINT "catalogo_rubrica_snc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogo_categoria_custo" (
    "id" TEXT NOT NULL,
    "familia" "CandFamily" NOT NULL,
    "codigo" TEXT NOT NULL,
    "designacao" TEXT NOT NULL,

    CONSTRAINT "catalogo_categoria_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogo_indicador" (
    "codigo" TEXT NOT NULL,
    "designacao" TEXT NOT NULL,
    "unidade" TEXT,
    "dominio" TEXT,

    CONSTRAINT "catalogo_indicador_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "catalogo_dominio_intl" (
    "numero" INTEGER NOT NULL,
    "designacao" TEXT NOT NULL,

    CONSTRAINT "catalogo_dominio_intl_pkey" PRIMARY KEY ("numero")
);

-- CreateTable
CREATE TABLE "catalogo_tipo_documento" (
    "codigo" TEXT NOT NULL,
    "designacao" TEXT NOT NULL,
    "subpasta_workdrive" TEXT NOT NULL,

    CONSTRAINT "catalogo_tipo_documento_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "catalogo_anexo" (
    "id" TEXT NOT NULL,
    "familia" "CandFamily" NOT NULL,
    "nivel" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "designacao" TEXT NOT NULL,
    "condicao" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "catalogo_anexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalogo_geo_nuts2_idx" ON "catalogo_geo"("nuts2");

-- CreateIndex
CREATE INDEX "catalogo_geo_concelho_idx" ON "catalogo_geo"("concelho");

-- CreateIndex
CREATE INDEX "catalogo_rubrica_snc_tipo_idx" ON "catalogo_rubrica_snc"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_rubrica_snc_tipo_codigo_key" ON "catalogo_rubrica_snc"("tipo", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_categoria_custo_familia_codigo_key" ON "catalogo_categoria_custo"("familia", "codigo");

-- CreateIndex
CREATE INDEX "catalogo_anexo_familia_nivel_idx" ON "catalogo_anexo"("familia", "nivel");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_anexo_familia_codigo_key" ON "catalogo_anexo"("familia", "codigo");

