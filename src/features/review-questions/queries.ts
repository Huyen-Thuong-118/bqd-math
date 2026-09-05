import "server-only";

import { notFound } from "next/navigation";
import { requireActiveStudentId } from "@/features/exams/access";
import { db } from "@/lib/db";

export async function getReviewChaptersForCurrentStudent() {
  const studentId = await requireActiveStudentId();
  const chapters = await db.chapter.findMany({
    where: { questions: { some: { classLinks: { some: { class: { enrollments: { some: { studentId } } } } } } } },
    select: { id: true, name: true, order: true, questions: { where: { classLinks: { some: { class: { enrollments: { some: { studentId } } } } } }, select: { id: true, attempts: { where: { userId: studentId }, select: { isCorrect: true } } } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return chapters.map((chapter) => { const attempts = chapter.questions.flatMap((question) => question.attempts); const correct = attempts.filter((attempt) => attempt.isCorrect).length; return { id: chapter.id, name: chapter.name, questionCount: chapter.questions.length, attemptCount: attempts.length, correctRate: attempts.length ? Math.round(correct / attempts.length * 100) : null }; });
}

export async function getReviewQuestionsForCurrentStudent(chapterId: string, filters: { q?: string; difficulty?: string }) {
  const studentId = await requireActiveStudentId();
  const chapter = await db.chapter.findFirst({ where: { id: chapterId, questions: { some: { classLinks: { some: { class: { enrollments: { some: { studentId } } } } } } } }, select: { id: true, name: true } });
  if (!chapter) notFound();
  const difficulty = ["EASY", "MEDIUM", "HARD"].includes(filters.difficulty ?? "") ? filters.difficulty as "EASY" | "MEDIUM" | "HARD" : undefined;
  const questions = await db.reviewQuestion.findMany({
    where: { chapterId, classLinks: { some: { class: { enrollments: { some: { studentId } } } } }, ...(difficulty ? { difficulty } : {}), ...(filters.q ? { OR: [{ content: { contains: filters.q, mode: "insensitive" } }, { topic: { contains: filters.q, mode: "insensitive" } }] } : {}) },
    select: { id: true, content: true, type: true, options: true, grade: true, topic: true, difficulty: true, attempts: { where: { userId: studentId }, select: { isCorrect: true }, orderBy: { attemptedAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
  return { chapter, questions: questions.map((question) => ({ ...question, options: Array.isArray(question.options) ? question.options.filter((item): item is string => typeof item === "string") : [], attemptCount: question.attempts.length, lastCorrect: question.attempts[0]?.isCorrect ?? null, attempts: undefined })) };
}
