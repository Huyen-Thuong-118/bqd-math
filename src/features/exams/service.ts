import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { ExamAccessError } from "./errors";
import { gradeExam } from "./grading";
import {
  canFinalizeExam,
  canStartExam,
  canWriteAnswers,
  effectiveAttemptExpiresAt,
} from "./availability";

/** Core bắt đầu bài tách khỏi session để integration test được trực tiếp. */
export async function startAttemptForUser(examId: string, userId: string) {
  const exam = await db.exam.findFirst({
    where: {
      id: examId,
      examLinks: {
        some: { class: { enrollments: { some: { studentId: userId } } } },
      },
    },
    select: {
      id: true,
      mode: true,
      isForever: true,
      availableFrom: true,
      availableTo: true,
      durationMinutes: true,
      maxAttempts: true,
      status: true,
      _count: { select: { questions: true } },
      attempts: {
        where: { userId },
        select: { id: true, submittedAt: true, expiresAt: true },
        orderBy: { startedAt: "desc" },
      },
    },
  });
  if (!exam) throw new ExamAccessError("Bạn không được giao đề này.", 404);
  if (exam.status !== "PUBLISHED") throw new ExamAccessError("Đề chưa xuất bản hoặc đã đóng.", 409);
  if (exam._count.questions === 0) {
    throw new ExamAccessError("Đề chưa có câu hỏi.", 409);
  }

  const now = new Date();
  const openAttempt = exam.attempts.find((attempt) => !attempt.submittedAt);
  if (openAttempt) {
    if (!canWriteAnswers(exam, openAttempt.expiresAt, now) && canFinalizeExam()) {
      await submitAttemptForUser(openAttempt.id, userId);
      return { attemptId: openAttempt.id, submitted: true };
    }
    return { attemptId: openAttempt.id, submitted: false };
  }
  if (!canStartExam(exam, now)) {
    throw new ExamAccessError("Đề chưa mở hoặc đã đóng.", 409);
  }
  if (exam.maxAttempts !== null && exam.attempts.length >= exam.maxAttempts) {
    throw new ExamAccessError("Bạn đã sử dụng hết số lượt làm bài.", 409);
  }

  const openKey = `${userId}:${exam.id}`;
  try {
    const attempt = await db.examAttempt.create({
      data: {
        examId: exam.id,
        userId,
        openKey,
        mode: exam.mode,
        expiresAt: effectiveAttemptExpiresAt(exam, now),
      },
      select: { id: true },
    });
    return { attemptId: attempt.id, submitted: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.examAttempt.findUnique({
        where: { openKey },
        select: { id: true },
      });
      if (existing) return { attemptId: existing.id, submitted: false };
    }
    throw error;
  }
}

/** Nộp/chấm idempotent: nhiều request cùng attempt vẫn chỉ tạo một snapshot. */
export async function submitAttemptForUser(attemptId: string, userId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ExamAttempt" WHERE "id" = ${attemptId} AND "userId" = ${userId} FOR UPDATE`);
    const attempt = await tx.examAttempt.findFirst({
      where: { id: attemptId, userId },
      select: {
        id: true,
        submittedAt: true,
        score: true,
        exam: {
          select: {
            scoringPolicy: true,
            questions: {
              select: { id: true, number: true, type: true, correctAnswer: true, points: true },
              orderBy: { number: "asc" },
            },
          },
        },
        answers: {
          select: { questionNumber: true, selectedAnswer: true },
          orderBy: [{ changedAt: "asc" }, { id: "asc" }],
        },
        finalizedAnswers: { select: { questionNumber: true, selectedAnswer: true } },
      },
    });
    if (!attempt) throw new ExamAccessError("Không tìm thấy lượt làm bài.", 404);
    if (attempt.submittedAt) return { attemptId: attempt.id, score: attempt.score };

    const latestAnswers = new Map<number, string>();
    for (const answer of attempt.answers) {
      latestAnswers.set(answer.questionNumber, answer.selectedAnswer);
    }
    for (const answer of attempt.finalizedAnswers) {
      if (answer.selectedAnswer) latestAnswers.set(answer.questionNumber, answer.selectedAnswer);
    }
    const rawPolicy = attempt.exam.scoringPolicy;
    const scoringPolicy = rawPolicy && typeof rawPolicy === "object" && !Array.isArray(rawPolicy)
      ? rawPolicy as { trueFalseFractions?: number[] }
      : {};
    const grade = gradeExam(attempt.exam.questions, latestAnswers, scoringPolicy);
    const submittedAt = new Date();

    const claimed = await tx.examAttempt.updateMany({
      where: { id: attempt.id, userId, submittedAt: null },
      data: {
        submittedAt,
        score: grade.score,
        correctCount: grade.correctCount,
        incorrectCount: grade.incorrectCount,
        unansweredCount: grade.unansweredCount,
        openKey: null,
      },
    });
    if (claimed.count === 0) {
      const completed = await tx.examAttempt.findUnique({
        where: { id: attempt.id },
        select: { score: true },
      });
      return { attemptId: attempt.id, score: completed?.score ?? null };
    }

    for (const answer of grade.answers) {
      await tx.attemptAnswer.upsert({ where: { attemptId_questionId: { attemptId: attempt.id, questionId: answer.questionId } }, update: answer, create: { attemptId: attempt.id, ...answer } });
    }
    return { attemptId: attempt.id, score: grade.score };
  });
}
