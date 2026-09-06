-- CreateEnum
CREATE TYPE "FolderKind" AS ENUM ('DOCUMENT', 'EXAM');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "kind" "FolderKind" NOT NULL DEFAULT 'DOCUMENT',
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Document_folderId_position_idx" ON "Document"("folderId", "position");

-- CreateIndex
CREATE INDEX "Exam_folderId_position_idx" ON "Exam"("folderId", "position");

-- CreateIndex
CREATE INDEX "Folder_kind_parentId_position_idx" ON "Folder"("kind", "parentId", "position");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
