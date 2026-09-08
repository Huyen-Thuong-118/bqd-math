-- Additive corrective migration: existing history rows receive stable generated
-- event identifiers before the uniqueness constraint is enabled.
CREATE TYPE "AttemptSubmissionReason" AS ENUM ('SUBMITTED', 'AUTO_SUBMITTED');

ALTER TABLE "ExamAttempt"
  ADD COLUMN "submissionReason" "AttemptSubmissionReason";

ALTER TABLE "AnswerHistory"
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "selectedAnswer" DROP NOT NULL;

UPDATE "AnswerHistory"
SET "eventId" = 'legacy-' || "id"
WHERE "eventId" IS NULL;

ALTER TABLE "AnswerHistory"
  ALTER COLUMN "eventId" SET NOT NULL;

CREATE UNIQUE INDEX "AnswerHistory_eventId_key" ON "AnswerHistory"("eventId");
CREATE INDEX "AnswerHistory_attemptId_questionNumber_changedAt_idx"
  ON "AnswerHistory"("attemptId", "questionNumber", "changedAt");
