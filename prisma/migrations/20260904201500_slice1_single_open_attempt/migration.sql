-- Chỉ attempt đang mở có openKey; sau khi nộp field về NULL. PostgreSQL cho
-- phép nhiều NULL trong unique index, nên vẫn giữ được nhiều lượt lịch sử.
ALTER TABLE "ExamAttempt" ADD COLUMN "openKey" TEXT;

CREATE UNIQUE INDEX "ExamAttempt_openKey_key" ON "ExamAttempt"("openKey");
