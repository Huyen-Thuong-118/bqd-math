-- CreateEnum
CREATE TYPE "ExamSource" AS ENUM ('PDF', 'QUESTION_BANK', 'MANUAL');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "source" "ExamSource" NOT NULL DEFAULT 'PDF',
ALTER COLUMN "examFileUrl" DROP NOT NULL;

-- Dữ liệu cũ dùng chuỗi rỗng để biểu diễn đề tạo từ ngân hàng câu hỏi.
UPDATE "Exam"
SET "source" = 'QUESTION_BANK', "examFileUrl" = NULL
WHERE "examFileUrl" = '';
