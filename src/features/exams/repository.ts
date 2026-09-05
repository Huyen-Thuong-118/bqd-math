import "server-only";

import { Prisma } from "@prisma/client";
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
  return db.$transaction(async (tx) => {
    // Khóa row attempt để autosave cuối và submit không vượt nhau.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ExamAttempt" WHERE "id" = ${payload.attemptId} AND "userId" = ${userId} FOR UPDATE`);
    const attempt = await tx.examAttempt.findFirst({ where: { id: payload.attemptId, userId }, select: { submittedAt: true, expiresAt: true, exam: { select: { questions: { select: { id: true, number: true } } } } } });
    if (!attempt) throw new ExamAccessError("Không tìm thấy lượt làm bài.", 404);
    if (attempt.submittedAt) throw new ExamAccessError("Bài đã được nộp.", 409);
    if (attempt.expiresAt && attempt.expiresAt <= new Date()) throw new ExamAccessError("Đã hết thời gian làm bài.", 409);
    const questionIdByNumber = new Map(attempt.exam.questions.map((question) => [question.number, question.id]));
    if (payload.changes.some((change) => !questionIdByNumber.has(change.questionNumber))) throw new ExamAccessError("Đáp án chứa số câu không hợp lệ.", 409);
    const receivedAt = Date.now(); const latestByQuestion = new Map<number, string>();
    for (const change of payload.changes) latestByQuestion.set(change.questionNumber, change.selectedAnswer.trim().toUpperCase());
    await tx.answerHistory.createMany({ data: payload.changes.map((change, index) => ({ attemptId: payload.attemptId, questionNumber: change.questionNumber, selectedAnswer: change.selectedAnswer.trim().toUpperCase(), changedAt: new Date(receivedAt + index) })) });
    for (const [questionNumber, selectedAnswer] of latestByQuestion) {
      const questionId = questionIdByNumber.get(questionNumber)!;
      await tx.attemptAnswer.upsert({ where: { attemptId_questionId: { attemptId: payload.attemptId, questionId } }, update: { selectedAnswer, questionNumber }, create: { attemptId: payload.attemptId, questionId, questionNumber, selectedAnswer } });
    }
    return { count: payload.changes.length };
  });
}

export async function getAnswerHistory(attemptId: string) {
  return db.answerHistory.findMany({
    where: { attemptId },
    orderBy: [{ questionNumber: "asc" }, { changedAt: "asc" }, { id: "asc" }],
  });
}

export async function getLatestAnswers(attemptId: string) {
  const latest = new Map<number, string>();
  for (const entry of await getAnswerHistory(attemptId)) latest.set(entry.questionNumber, entry.selectedAnswer);
  const rows = await db.attemptAnswer.findMany({ where: { attemptId, selectedAnswer: { not: null } }, select: { questionNumber: true, selectedAnswer: true } });
  for (const entry of rows) if (entry.selectedAnswer) latest.set(entry.questionNumber, entry.selectedAnswer);
  return latest;
}
