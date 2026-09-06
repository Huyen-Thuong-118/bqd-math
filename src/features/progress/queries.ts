import "server-only";

import type { Prisma } from "@prisma/client";

import { requireActiveAdminId } from "@/features/exams/admin";
import { db } from "@/lib/db";
import {
  calculateExamScoreMetrics,
  calculateOverallExamProgress,
} from "./metrics";

export type ProgressFilters = {
  classId: string;
  range: "30" | "90" | "all";
  activity: "all" | "exam" | "review";
  page: number;
};

function startDate(range: ProgressFilters["range"]) {
  if (range === "all") return undefined;
  const date = new Date();
  date.setDate(date.getDate() - Number(range));
  return date;
}

export async function getStudentProgress(studentId: string, filters: ProgressFilters) {
  await requireActiveAdminId();
  const student = await db.user.findFirst({
    where: { id: studentId, role: "STUDENT" },
    select: {
      id: true,
      name: true,
      email: true,
      studentCode: true,
      status: true,
      createdAt: true,
      classEnrollments: {
        select: { class: { select: { id: true, code: true, name: true, status: true } } },
        orderBy: { enrolledAt: "desc" },
      },
    },
  });
  if (!student) return null;

  const availableClassIds = new Set(student.classEnrollments.map((item) => item.class.id));
  const classId = filters.classId && availableClassIds.has(filters.classId) ? filters.classId : "";
  const since = startDate(filters.range);
  const examRelationWhere: Prisma.ExamWhereInput = classId
    ? { examLinks: { some: { classId } } }
    : { examLinks: { some: { classId: { in: [...availableClassIds] } } } };
  const submittedWhere: Prisma.ExamAttemptWhereInput = {
    userId: studentId,
    submittedAt: { not: null, ...(since ? { gte: since } : {}) },
    exam: examRelationWhere,
  };
  const reviewWhere: Prisma.ReviewAttemptWhereInput = {
    userId: studentId,
    ...(since ? { attemptedAt: { gte: since } } : {}),
    ...(classId ? { question: { classLinks: { some: { classId } } } } : {}),
  };
  const pageSize = 20;
  const skip = (filters.page - 1) * pageSize;

  const [assignedExams, submittedAttempts, reviewAttempts, historyTotal, examHistory] = await Promise.all([
    db.exam.findMany({
      where: examRelationWhere,
      select: { id: true, title: true, mode: true, status: true, examLinks: { where: { classId: { in: [...availableClassIds] } }, select: { class: { select: { id: true, code: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    db.examAttempt.findMany({
      where: submittedWhere,
      select: { id: true, examId: true, score: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
    }),
    db.reviewAttempt.findMany({
      where: reviewWhere,
      select: {
        id: true,
        isCorrect: true,
        attemptedAt: true,
        question: { select: { chapter: { select: { id: true, name: true } }, topic: true, difficulty: true } },
      },
      orderBy: { attemptedAt: "desc" },
    }),
    db.examAttempt.count({ where: submittedWhere }),
    filters.activity === "review" ? Promise.resolve([]) : db.examAttempt.findMany({
      where: submittedWhere,
      select: {
        id: true,
        score: true,
        correctCount: true,
        incorrectCount: true,
        unansweredCount: true,
        startedAt: true,
        submittedAt: true,
        exam: { select: { id: true, title: true, mode: true } },
      },
      orderBy: { submittedAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const attemptsByExam = new Map<string, typeof submittedAttempts>();
  for (const attempt of submittedAttempts) {
    attemptsByExam.set(attempt.examId, [...(attemptsByExam.get(attempt.examId) ?? []), attempt]);
  }
  const examSummaries = assignedExams.map((exam) => {
    const attempts = attemptsByExam.get(exam.id) ?? [];
    return {
      ...exam,
      ...calculateExamScoreMetrics(attempts),
    };
  });
  const overallExamProgress = calculateOverallExamProgress(
    assignedExams.map((exam) => exam.id),
    submittedAttempts,
  );

  const chapterMap = new Map<string, { id: string; name: string; attempts: number; correct: number }>();
  for (const attempt of reviewAttempts) {
    const chapter = attempt.question.chapter;
    const current = chapterMap.get(chapter.id) ?? { id: chapter.id, name: chapter.name, attempts: 0, correct: 0 };
    current.attempts += 1;
    if (attempt.isCorrect) current.correct += 1;
    chapterMap.set(chapter.id, current);
  }

  const trend = new Map<string, { week: string; examScores: number[]; reviewAttempts: number; reviewCorrect: number }>();
  const ensureWeek = (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const key = start.toISOString().slice(0, 10);
    const value = trend.get(key) ?? { week: key, examScores: [], reviewAttempts: 0, reviewCorrect: 0 };
    trend.set(key, value);
    return value;
  };
  submittedAttempts.forEach((attempt) => {
    if (attempt.submittedAt && attempt.score !== null) ensureWeek(attempt.submittedAt).examScores.push(attempt.score);
  });
  reviewAttempts.forEach((attempt) => {
    const bucket = ensureWeek(attempt.attemptedAt);
    bucket.reviewAttempts += 1;
    if (attempt.isCorrect) bucket.reviewCorrect += 1;
  });

  return {
    student: {
      ...student,
      createdAt: student.createdAt.toISOString(),
      classes: student.classEnrollments.map((item) => item.class),
      classEnrollments: undefined,
    },
    selectedClassId: classId,
    summary: {
      ...overallExamProgress,
      reviewAttempts: reviewAttempts.length,
      reviewCorrect: reviewAttempts.filter((attempt) => attempt.isCorrect).length,
    },
    examSummaries,
    reviewByChapter: [...chapterMap.values()].sort((a, b) => b.attempts - a.attempts),
    reviewRecent: filters.activity === "exam" ? [] : reviewAttempts.slice(0, 20).map((attempt) => ({
      id: attempt.id,
      chapter: attempt.question.chapter.name,
      topic: attempt.question.topic,
      difficulty: attempt.question.difficulty,
      isCorrect: attempt.isCorrect,
      attemptedAt: attempt.attemptedAt.toISOString(),
    })),
    examHistory: examHistory.map((attempt) => ({ ...attempt, startedAt: attempt.startedAt.toISOString(), submittedAt: attempt.submittedAt?.toISOString() ?? null })),
    pagination: { page: filters.page, pageSize, total: historyTotal, totalPages: Math.max(1, Math.ceil(historyTotal / pageSize)) },
    trend: [...trend.values()].sort((a, b) => a.week.localeCompare(b.week)).map((item) => ({
      week: item.week,
      examAverage: item.examScores.length ? item.examScores.reduce((sum, score) => sum + score, 0) / item.examScores.length : null,
      reviewRate: item.reviewAttempts ? item.reviewCorrect / item.reviewAttempts * 100 : null,
    })),
  };
}
