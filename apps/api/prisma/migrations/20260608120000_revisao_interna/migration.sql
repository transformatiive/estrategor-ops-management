-- CreateTable
CREATE TABLE "revisoes_internas" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "comentarios" TEXT,
    "revisor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisoes_internas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revisoes_internas_project_id_idx" ON "revisoes_internas"("project_id");

-- AddForeignKey
ALTER TABLE "revisoes_internas" ADD CONSTRAINT "revisoes_internas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisoes_internas" ADD CONSTRAINT "revisoes_internas_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
