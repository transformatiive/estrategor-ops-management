-- AlterTable: um diagnóstico passa a poder pertencer a uma lead (ou a um projeto)
ALTER TABLE "diagnostics" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "diagnostics" ADD COLUMN "lead_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "diagnostics_lead_id_key" ON "diagnostics"("lead_id");

-- AddForeignKey
ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
