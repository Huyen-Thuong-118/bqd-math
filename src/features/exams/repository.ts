import "server-only";

import { db } from "@/lib/db";
import { ExamAccessError } from "./errors";
import type { AnswerBatchPayload } from "./types";

const MAX_CHANGES_PER_BATCH = 100;

export function validateAnswerBatch(payload: unknown): payload is AnswerBatchPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Partial<AnswerBatchPayload>;
  return (
    typeof value.attemptId === "string" &&
    Array.isArray(value.changes) &&
    value.changes.length <= MAX_CHANGES_PER_BATCH &&
    value.changes.every(
      (change) =>
        change &&
        Number.isInteger(change.questionNumber) &&
        change.questionNumber > 0 &&
        typeof change.selectedAnswer === "string" &&
        change.selectedAnswer.trim().length > 0 &&
        change.selectedAnswer.length <= 50 &&
        typeof change.changedAt === "string" &&
        Number.isFinite(Date.parse(change.changedAt)),
    )
  );
}

/** Autosave có ownership, deadline, trạng thái và số câu hợp lệ. */
export async function saveAnswerBatchForUser(
  userId: string,
  payload: AnswerBatchPayload,
) {
  if (payload.changes.length === 0) return { count: 0 };

  const attempt = await db.examAttempt.findFirst({
    where: { id: payload.attemptId, userId },
    select: {
      submittedAt: true,
      expiresAt: true,
      exam: { select: { questions: { select: { number: true } } } },
    },
  });
  if (!attempt) throw new ExamAccessError("Không tìm thấy lượt làm bài.", 404);
  if (attempt.submittedAt) throw new ExamAccessError("Bài đã được nộp.", 409);
  if (attempt.expiresAt && attempt.expiresAt <= new Date()) {
    throw new ExamAccessError("Đã hết thời gian làm bài.", 409);
  }

  const validNumbers = new Set(attempt.exam.questions.map((question) => question.number));
  if (payload.changes.some((change) => !validNumbers.has(change.questionNumber))) {
    throw new ExamAccessError("Đáp án chứa số câu không hợp lệ.", 409);
  }

  const receivedAt = Date.now();
  return db.answerHistory.createMany({
    data: payload.changes.map((change, index) => ({
      attemptId: payload.attemptId,
      questionNumber: change.questionNumber,
      selectedAnswer: change.selectedAnswer.trim().toUpperCase(),
      // Thời gian client chỉ phục vụ UX; thứ tự chính thức lấy lúc server nhận
      // để người dùng không thể gửi timestamp giả làm thay đổi đáp án cuối.
      changedAt: new Date(receivedAt + index),
    })),
  });
}

export async function getAnswerHistory(attemptId: string) {
  return db.answerHistory.findMany({
    where: { attemptId },
    orderBy: [{ questionNumber: "asc" }, { changedAt: "asc" }, { id: "asc" }],
  });
}

export async function getLatestAnswers(attemptId: string) {
  const all = await getAnswerHistory(attemptId);
  const latest = new Map<number, string>();
  for (const entry of all) latest.set(entry.questionNumber, entry.selectedAnswer);
  return latest;
}
