import "server-only";

import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireActiveAdminId } from "@/features/exams/admin";
import { requireActiveStudentId } from "@/features/exams/access";
import { db } from "@/lib/db";

import {
  QUESTION_BANK_PAGE_SIZE,
  REVIEW_QUESTION_PAGE_SIZE,
  type ReviewQuestionFilters,
} from "./filters";

const questionListSelect = {
  id: true,
  chapterId: true,
  content: true,
  type: true,
  options: true,
  correctAnswer: true,
  grade: true,
  topic: true,
  difficulty: true,
  textSolution: true,
  solutionImageUrl: true,
  questionImageKeys: true,
  solutionImageKeys: true,
  videoUid: true,
  showSolution: true,
  classLinks: {
    select: { classId: true, class: { select: { name: true } } },
  },
  attempts: { select: { isCorrect: true } },
} satisfies Prisma.ReviewQuestionSelect;

function questionWhere(
  filters: ReviewQuestionFilters,
  access: Prisma.ReviewQuestionWhereInput = {},
): Prisma.ReviewQuestionWhereInput {
  const hasSolution = {
    OR: [
      { textSolution: { not: null } },
      { solutionImageUrl: { not: null } },
      { solutionImageKeys: { not: [] } },
      { videoUid: { not: null } },
      { videoUrl: { not: null } },
    ],
  } satisfies Prisma.ReviewQuestionWhereInput;

  return {
    AND: [
      access,
      ...(filters.q
        ? [{
            OR: [
              { content: { contains: filters.q, mode: "insensitive" as const } },
              { topic: { contains: filters.q, mode: "insensitive" as const } },
              { grade: { contains: filters.q, mode: "insensitive" as const } },
              { chapter: { name: { contains: filters.q, mode: "insensitive" as const } } },
            ],
          }]
        : []),
      ...(filters.chapterId ? [{ chapterId: filters.chapterId }] : []),
      ...(filters.grade
        ? [{ grade: { equals: filters.grade, mode: "insensitive" as const } }]
        : []),
      ...(filters.topic
        ? [{ topic: { contains: filters.topic, mode: "insensitive" as const } }]
        : []),
      ...(filters.type ? [{ type: filters.type }] : []),
      ...(filters.difficulty ? [{ difficulty: filters.difficulty }] : []),
      ...(filters.classId
        ? [{ classLinks: { some: { classId: filters.classId } } }]
        : []),
      ...(filters.solution === "HAS_SOLUTION" ? [hasSolution] : []),
      ...(filters.solution === "NO_SOLUTION" ? [{ NOT: hasSolution }] : []),
      ...(filters.solution === "VISIBLE" ? [{ showSolution: true }] : []),
      ...(filters.solution === "HIDDEN" ? [{ showSolution: false }] : []),
    ],
  };
}

function mapAdminQuestion(item: Prisma.ReviewQuestionGetPayload<{ select: typeof questionListSelect }>) {
  const attempts = item.attempts.length;
  return {
    ...item,
    options: Array.isArray(item.options)
      ? item.options.filter((option): option is string => typeof option === "string")
      : [],
    questionImageUrls: Array.isArray(item.questionImageKeys)
      ? item.questionImageKeys.flatMap((key, index) => typeof key === "string" ? [`/api/review-questions/${item.id}/assets/question/${index}`] : [])
      : [],
    solutionImageUrls: Array.isArray(item.solutionImageKeys)
      ? item.solutionImageKeys.flatMap((key, index) => typeof key === "string" ? [`/api/review-questions/${item.id}/assets/solution/${index}`] : [])
      : [],
    questionImageKeys: undefined,
    solutionImageKeys: undefined,
    classIds: item.classLinks.map((link) => link.classId),
    classNames: item.classLinks.map((link) => link.class.name),
    classLinks: undefined,
    attempts,
    correctRate: attempts
      ? Math.round(item.attempts.filter((attempt) => attempt.isCorrect).length / attempts * 100)
      : null,
  };
}

export async function getAdminReviewQuestionsPage(filters: ReviewQuestionFilters) {
  await requireActiveAdminId();
  const where = questionWhere(filters);
  const [chapters, classes, rows, total] = await Promise.all([
    db.chapter.findMany({
      select: { id: true, name: true, order: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    db.class.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    db.reviewQuestion.findMany({
      where,
      select: questionListSelect,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * REVIEW_QUESTION_PAGE_SIZE,
      take: REVIEW_QUESTION_PAGE_SIZE,
    }),
    db.reviewQuestion.count({ where }),
  ]);

  return {
    chapters,
    classes,
    questions: rows.map(mapAdminQuestion),
    pagination: {
      page: filters.page,
      pageSize: REVIEW_QUESTION_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / REVIEW_QUESTION_PAGE_SIZE)),
    },
  };
}

export async function getQuestionBankPage(filters: ReviewQuestionFilters) {
  await requireActiveAdminId();
  const where = questionWhere(filters);
  const [rows, total] = await Promise.all([
    db.reviewQuestion.findMany({
      where,
      select: {
        id: true,
        content: true,
        type: true,
        topic: true,
        grade: true,
        difficulty: true,
        chapter: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * QUESTION_BANK_PAGE_SIZE,
      take: QUESTION_BANK_PAGE_SIZE,
    }),
    db.reviewQuestion.count({ where }),
  ]);

  return {
    questions: rows.map((item) => ({ ...item, chapter: item.chapter.name })),
    pagination: {
      page: filters.page,
      pageSize: QUESTION_BANK_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / QUESTION_BANK_PAGE_SIZE)),
    },
  };
}

export async function getReviewChaptersForCurrentStudent() {
  const studentId = await requireActiveStudentId();
  const chapters = await db.chapter.findMany({
    where: { questions: { some: { classLinks: { some: { class: { enrollments: { some: { studentId } } } } } } } },
    select: { id: true, name: true, order: true, questions: { where: { classLinks: { some: { class: { enrollments: { some: { studentId } } } } } }, select: { id: true, attempts: { where: { userId: studentId }, select: { isCorrect: true } } } } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return chapters.map((chapter) => { const attempts = chapter.questions.flatMap((question) => question.attempts); const correct = attempts.filter((attempt) => attempt.isCorrect).length; return { id: chapter.id, name: chapter.name, questionCount: chapter.questions.length, attemptCount: attempts.length, correctRate: attempts.length ? Math.round(correct / attempts.length * 100) : null }; });
}

export async function getReviewQuestionsForCurrentStudent(
  chapterId: string,
  filters: ReviewQuestionFilters,
) {
  const studentId = await requireActiveStudentId();
  const chapter = await db.chapter.findFirst({ where: { id: chapterId, questions: { some: { classLinks: { some: { class: { enrollments: { some: { studentId } } } } } } } }, select: { id: true, name: true } });
  if (!chapter) notFound();
  const accessWhere = {
    chapterId,
    classLinks: { some: { class: { enrollments: { some: { studentId } } } } },
  } satisfies Prisma.ReviewQuestionWhereInput;
  const where = questionWhere({ ...filters, chapterId }, accessWhere);
  const [questions, total, classes, topicRows, gradeRows] = await Promise.all([
    db.reviewQuestion.findMany({
    where,
    select: { id: true, content: true, type: true, options: true, questionImageKeys: true, grade: true, topic: true, difficulty: true, attempts: { where: { userId: studentId }, select: { isCorrect: true }, orderBy: { attemptedAt: "desc" } } },
    orderBy: { createdAt: "asc" },
    skip: (filters.page - 1) * REVIEW_QUESTION_PAGE_SIZE,
    take: REVIEW_QUESTION_PAGE_SIZE,
    }),
    db.reviewQuestion.count({ where }),
    db.class.findMany({
      where: {
        enrollments: { some: { studentId } },
        questionLinks: { some: { question: { chapterId } } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.reviewQuestion.findMany({
      where: accessWhere,
      distinct: ["topic"],
      select: { topic: true },
      orderBy: { topic: "asc" },
    }),
    db.reviewQuestion.findMany({
      where: accessWhere,
      distinct: ["grade"],
      select: { grade: true },
      orderBy: { grade: "asc" },
    }),
  ]);
  return {
    chapter,
    questions: questions.map((question) => ({
      ...question,
      options: Array.isArray(question.options)
        ? question.options.filter((item): item is string => typeof item === "string")
        : [],
      questionImageUrls: Array.isArray(question.questionImageKeys)
        ? question.questionImageKeys.flatMap((key, index) => typeof key === "string" ? [`/api/review-questions/${question.id}/assets/question/${index}`] : [])
        : [],
      questionImageKeys: undefined,
      attemptCount: question.attempts.length,
      lastCorrect: question.attempts[0]?.isCorrect ?? null,
      attempts: undefined,
    })),
    filters: {
      classes,
      topics: topicRows.flatMap((item) => item.topic ? [item.topic] : []),
      grades: gradeRows.flatMap((item) => item.grade ? [item.grade] : []),
    },
    pagination: {
      page: filters.page,
      pageSize: REVIEW_QUESTION_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / REVIEW_QUESTION_PAGE_SIZE)),
    },
  };
}
