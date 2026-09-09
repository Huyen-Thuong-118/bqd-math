import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ExamAccessError } from "./errors";
import { canWriteAnswers } from "./availability";
import { isValidExamAnswer } from "./question-contract";
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
        typeof change.eventId === "string" &&
        /^[a-zA-Z0-9_-]{16,128}$/.test(change.eventId) &&
        Number.isInteger(change.questionNumber) &&
        change.questionNumber > 0 &&
        (change.selectedAnswer === null ||
          (typeof change.selectedAnswer === "string" &&
            change.selectedAnswer.trim().length > 0 &&
            change.selectedAnswer.length <= 50)) &&
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
    const attempt = await tx.examAttempt.findFirst({
      where: { id: payload.attemptId, userId },
      select: {
        submittedAt: true,
        expiresAt: true,
        exam: {
          select: {
            status: true,
            mode: true,
            isForever: true,
            availableFrom: true,
            availableTo: true,
            durationMinutes: true,
            questions: { select: { id: true, number: true, type: true, options: true } },
            examLinks: {
              where: { class: { enrollments: { some: { studentId: userId } } } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!attempt) throw new ExamAccessError("Không tìm thấy lượt làm bài.", 404);
    if (attempt.submittedAt) throw new ExamAccessError("Bài đã được nộp.", 409);
    if (!attempt.exam.examLinks.length || !canWriteAnswers(attempt.exam, attempt.expiresAt)) throw new ExamAccessError("Đề đã đóng hoặc bạn không còn quyền làm bài.", 409);
    const questionIdByNumber = new Map(attempt.exam.questions.map((question) => [question.number, question.id]));
    if (payload.changes.some((change) => !questionIdByNumber.has(change.questionNumber))) throw new ExamAccessError("Đáp án chứa số câu không hợp lệ.", 409);
    const questionByNumber = new Map(attempt.exam.questions.map((question) => [question.number, question]));
    if (payload.changes.some((change) => {
      const question = questionByNumber.get(change.questionNumber)!;
      return !isValidExamAnswer(
        {
          type: question.type,
          options: Array.isArray(question.options)
            ? question.options.filter((option): option is string => typeof option === "string")
            : [],
        },
        change.selectedAnswer,
      );
    })) throw new ExamAccessError("Đáp án không đúng định dạng của câu hỏi.", 400);
    const existingEvents = await tx.answerHistory.findMany({
      where: { eventId: { in: payload.changes.map((change) => change.eventId) } },
      select: { eventId: true },
    });
    const existingEventIds = new Set(existingEvents.map((event) => event.eventId));
    const newChanges = payload.changes.filter(
      (change) => !existingEventIds.has(change.eventId),
    );
    const latestByQuestion = new Map<number, string | null>();
    for (const change of newChanges) {
      latestByQuestion.set(
        change.questionNumber,
        change.selectedAnswer?.trim().toUpperCase() ?? null,
      );
    }
    await tx.answerHistory.createMany({
      data: newChanges.map((change) => ({
        eventId: change.eventId,
        attemptId: payload.attemptId,
        questionNumber: change.questionNumber,
        selectedAnswer: change.selectedAnswer?.trim().toUpperCase() ?? null,
        changedAt: new Date(change.changedAt),
      })),
      skipDuplicates: true,
    });
    for (const [questionNumber, selectedAnswer] of latestByQuestion) {
      const questionId = questionIdByNumber.get(questionNumber)!;
      await tx.attemptAnswer.upsert({ where: { attemptId_questionId: { attemptId: payload.attemptId, questionId } }, update: { selectedAnswer, questionNumber }, create: { attemptId: payload.attemptId, questionId, questionNumber, selectedAnswer } });
    }
    return { count: payload.changes.length, acknowledgedEventIds: payload.changes.map((change) => change.eventId) };
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
  for (const entry of await getAnswerHistory(attemptId)) {
    if (entry.selectedAnswer) latest.set(entry.questionNumber, entry.selectedAnswer);
    else latest.delete(entry.questionNumber);
  }
  const rows = await db.attemptAnswer.findMany({ where: { attemptId, selectedAnswer: { not: null } }, select: { questionNumber: true, selectedAnswer: true } });
  for (const entry of rows) if (entry.selectedAnswer) latest.set(entry.questionNumber, entry.selectedAnswer);
  return latest;
}
