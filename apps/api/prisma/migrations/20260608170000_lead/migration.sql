-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'analise',
    "project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_project_id_key" ON "leads"("project_id");

-- CreateIndex
CREATE INDEX "leads_client_id_idx" ON "leads"("client_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: um pré-diagnóstico passa a poder pertencer a uma lead (ou a um projeto)
ALTER TABLE "pre_diagnosticos" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "pre_diagnosticos" ADD COLUMN "lead_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "pre_diagnosticos_lead_id_key" ON "pre_diagnosticos"("lead_id");

-- AddForeignKey
ALTER TABLE "pre_diagnosticos" ADD CONSTRAINT "pre_diagnosticos_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
