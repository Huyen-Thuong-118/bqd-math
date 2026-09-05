CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "ReviewQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER');
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

ALTER TABLE "Exam"
ADD COLUMN "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "scoringPolicy" JSONB;

UPDATE "Exam" SET "status" = 'PUBLISHED', "publishedAt" = "createdAt";

ALTER TABLE "Document"
ADD COLUMN "fileName" TEXT NOT NULL DEFAULT 'tai-lieu.pdf',
ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'application/pdf';

ALTER TABLE "ReviewQuestion"
ADD COLUMN "type" "ReviewQuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
ADD COLUMN "grade" TEXT,
ADD COLUMN "topic" TEXT,
ADD COLUMN "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN "solutionImageUrl" TEXT,
ADD COLUMN "videoUid" TEXT,
ADD COLUMN "showSolution" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "DocumentClass" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  CONSTRAINT "DocumentClass_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassAnnouncement" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentClass_documentId_classId_key" ON "DocumentClass"("documentId", "classId");
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");
CREATE INDEX "ClassAnnouncement_classId_createdAt_idx" ON "ClassAnnouncement"("classId", "createdAt");

ALTER TABLE "DocumentClass" ADD CONSTRAINT "DocumentClass_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentClass" ADD CONSTRAINT "DocumentClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassAnnouncement" ADD CONSTRAINT "ClassAnnouncement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Chuyển các gán tài liệu kiểu cũ sang bảng N-N mới.
INSERT INTO "DocumentClass" ("id", "documentId", "classId")
SELECT CONCAT('migrated-', "id"), "id", "classId" FROM "Document" WHERE "classId" IS NOT NULL
ON CONFLICT ("documentId", "classId") DO NOTHING;

INSERT INTO "DocumentVersion" ("id", "documentId", "version", "fileUrl", "fileName", "contentType", "createdAt")
SELECT CONCAT('initial-', "id"), "id", GREATEST("updateCount" + 1, 1), "fileUrl", "fileName", "contentType", "createdAt" FROM "Document"
ON CONFLICT ("documentId", "version") DO NOTHING;
