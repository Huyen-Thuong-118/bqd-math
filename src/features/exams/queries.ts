import "server-only";

import { db } from "@/lib/db";
import { requireActiveStudentId } from "./access";
import type {
  AnswerChange,
  ExamListItem,
  ExamResult,
  TakingAttempt,
} from "./types";

function stringOptions(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function availability(
  exam: { isForever: boolean; availableFrom: Date | null; availableTo: Date | null },
  now: Date,
) {
  if (exam.isForever) return { available: true, label: "Luôn mở" };
  if (exam.availableFrom && exam.availableFrom > now) {
    return {
      available: false,
      label: `Mở từ ${exam.availableFrom.toLocaleString("vi-VN")}`,
    };
  }
  if (exam.availableTo && exam.availableTo < now) {
    return { available: false, label: "Đã đóng" };
  }
  return {
    available: true,
    label: exam.availableTo
      ? `Đến ${exam.availableTo.toLocaleString("vi-VN")}`
      : "Đang mở",
  };
}

export async function getExamListForCurrentStudent(): Promise<ExamListItem[]> {
  const userId = await requireActiveStudentId();
  const exams = await db.exam.findMany({
    where: {
      examLinks: {
        some: { class: { enrollments: { some: { studentId: userId } } } },
      },
    },
    select: {
      id: true,
      title: true,
      mode: true,
      durationMinutes: true,
      maxAttempts: true,
      isForever: true,
      availableFrom: true,
      availableTo: true,
      _count: { select: { questions: true } },
      attempts: {
        where: { userId },
        select: { id: true, score: true, submittedAt: true, startedAt: true },
        orderBy: { startedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();

  return exams.map((exam) => {
    const state = availability(exam, now);
    const scores = exam.attempts
      .map((attempt) => attempt.score)
      .filter((score): score is number => score !== null);
    return {
      id: exam.id,
      title: exam.title,
      mode: exam.mode,
      durationMinutes: exam.durationMinutes,
      questionCount: exam._count.questions,
      maxAttempts: exam.maxAttempts,
      attemptCount: exam.attempts.length,
      bestScore: scores.length ? Math.max(...scores) : null,
      openAttemptId:
        exam.attempts.find((attempt) => !attempt.submittedAt)?.id ?? null,
      available: state.available,
      availabilityLabel: state.label,
    };
  });
}

export async function getTakingAttempt(
  examId: string,
  attemptId: string,
): Promise<TakingAttempt | { submitted: true } | null> {
  const userId = await requireActiveStudentId();
  const attempt = await db.examAttempt.findFirst({
    where: {
      id: attemptId,
      examId,
      userId,
      exam: {
        examLinks: {
          some: { class: { enrollments: { some: { studentId: userId } } } },
        },
      },
    },
    select: {
      id: true,
      examId: true,
      mode: true,
      startedAt: true,
      expiresAt: true,
      submittedAt: true,
      exam: {
        select: {
          title: true,
          examFileUrl: true,
          answerFileUrl: true,
          showAnswer: true,
          allowDownload: true,
          questions: {
            select: { id: true, number: true, type: true, content: true, options: true, points: true },
            orderBy: { number: "asc" },
          },
        },
      },
      answers: {
        select: { questionNumber: true, selectedAnswer: true, changedAt: true },
        orderBy: [{ changedAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!attempt) return null;
  if (attempt.submittedAt) return { submitted: true };

  const initialAnswers: Record<number, string> = {};
  const initialHistory: AnswerChange[] = [];
  for (const answer of attempt.answers) {
    initialAnswers[answer.questionNumber] = answer.selectedAnswer;
    initialHistory.push({
      questionNumber: answer.questionNumber,
      selectedAnswer: answer.selectedAnswer,
      changedAt: answer.changedAt.toISOString(),
    });
  }

  return {
    id: attempt.id,
    examId: attempt.examId,
    examTitle: attempt.exam.title,
    mode: attempt.mode,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt?.toISOString() ?? null,
    hasExamFile: Boolean(attempt.exam.examFileUrl),
    hasAnswerFile: Boolean(attempt.exam.answerFileUrl),
    showAnswer: attempt.exam.showAnswer,
    allowDownload: attempt.exam.allowDownload,
    questions: attempt.exam.questions.map((question) => ({
      ...question,
      options: stringOptions(question.options),
    })),
    initialAnswers,
    initialHistory,
  };
}

export async function getExamResult(
  examId: string,
  attemptId: string,
): Promise<ExamResult | null> {
  const userId = await requireActiveStudentId();
  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, examId, userId, submittedAt: { not: null } },
    select: {
      id: true,
      examId: true,
      score: true,
      correctCount: true,
      incorrectCount: true,
      unansweredCount: true,
      startedAt: true,
      submittedAt: true,
      exam: {
        select: {
          title: true,
          hideWrongAnswers: true,
          examFileUrl: true,
          answerFileUrl: true,
          showAnswer: true,
          allowDownload: true,
        },
      },
      finalizedAnswers: {
        select: {
          questionNumber: true,
          selectedAnswer: true,
          correctAnswer: true,
          isCorrect: true,
          pointsAwarded: true,
          pointsPossible: true,
          question: { select: { content: true, options: true, explanation: true } },
        },
        orderBy: { questionNumber: "asc" },
      },
    },
  });
  if (!attempt || attempt.score === null || !attempt.submittedAt) return null;

  return {
    attemptId: attempt.id,
    examId: attempt.examId,
    examTitle: attempt.exam.title,
    score: attempt.score,
    correctCount: attempt.correctCount ?? 0,
    incorrectCount: attempt.incorrectCount ?? 0,
    unansweredCount: attempt.unansweredCount ?? 0,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt.toISOString(),
    hasExamFile: Boolean(attempt.exam.examFileUrl),
    hasAnswerFile: Boolean(attempt.exam.answerFileUrl),
    showAnswer: attempt.exam.showAnswer,
    allowDownload: attempt.exam.allowDownload,
    questions: attempt.finalizedAnswers.map((answer) => ({
      questionNumber: answer.questionNumber,
      content: answer.question.content,
      options: stringOptions(answer.question.options),
      selectedAnswer: answer.selectedAnswer,
      correctAnswer:
        attempt.exam.hideWrongAnswers && !answer.isCorrect
          ? null
          : answer.correctAnswer,
      isCorrect: answer.isCorrect,
      pointsAwarded: answer.pointsAwarded,
      pointsPossible: answer.pointsPossible,
      explanation: answer.question.explanation,
    })),
  };
}
