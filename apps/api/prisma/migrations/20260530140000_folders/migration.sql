-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workdrive_id" TEXT,
    "workdrive_url" TEXT,
    "parent_path" TEXT,
    "is_root" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "folders_project_id_idx" ON "folders"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "folders_project_id_path_key" ON "folders"("project_id", "path");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
