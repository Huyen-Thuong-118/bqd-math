"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireActiveAdminId } from "@/features/exams/admin";
import { requireActiveStudentId } from "@/features/exams/access";
import { db } from "@/lib/db";
import { deleteDocument } from "@/lib/storage";
import { buildStreamPlaybackUrl, getSignedStreamToken } from "@/lib/stream";

import { parseReviewQuestionFilters } from "./filters";
import { getQuestionBankPage } from "./queries";
import { persistReviewQuestionFigures, ReviewQuestionImportError } from "./importer";

type Result = { success: true } | { success: false; error: string };
export type ReviewAnswerResult =
  | { success: true; correct: boolean; solutionVisible: boolean; correctAnswer: string; textSolution: string | null; solutionImageUrl: string | null; solutionImageUrls: string[]; videoUrl: string | null; attempts: number; correctRate: number }
  | { success: false; error: string };
export type QuestionBankSearchResult =
  | { success: true; data: Awaited<ReturnType<typeof getQuestionBankPage>> }
  | { success: false; error: string };

function text(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" ? value.trim() : ""; }
function checked(formData: FormData, key: string) { return formData.get(key) === "on" || formData.get(key) === "true"; }
function refresh(chapterId?: string) { revalidatePath("/admin/cau-hoi-on-tap"); revalidatePath("/on-tap"); if (chapterId) revalidatePath(`/on-tap/${chapterId}`); revalidatePath("/lop-hoc"); }

function normalize(answer: string, type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER") {
  const trimmed = answer.trim();
  if (type === "SHORT_ANSWER") {
    return /^[-+]?\d+(?:,\d+)?$/.test(trimmed)
      ? trimmed.replace(",", ".")
      : trimmed;
  }
  let result = trimmed.toUpperCase().replace(/\s+/g, " ");
  if (type === "TRUE_FALSE") result = result.replace(/Đ/g, "D").replace(/[;|/]/g, ",").replace(/\s*,\s*/g, ",");
  return result;
}

function parseQuestion(formData: FormData) {
  const chapterId = text(formData, "chapterId");
  const content = text(formData, "content");
  const type = (["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"].includes(text(formData, "type")) ? text(formData, "type") : "MULTIPLE_CHOICE") as "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  const difficulty = (["EASY", "MEDIUM", "HARD"].includes(text(formData, "difficulty")) ? text(formData, "difficulty") : "MEDIUM") as "EASY" | "MEDIUM" | "HARD";
  const optionItems = formData.getAll("optionItems").filter((item): item is string => typeof item === "string");
  const options = (optionItems.length ? optionItems : text(formData, "options").split("\n")).map((item) => item.trim()).filter(Boolean);
  const correctAnswer = normalize(text(formData, "correctAnswer"), type);
  const classIds = [...new Set(formData.getAll("classIds").filter((item): item is string => typeof item === "string"))];
  const questionFigureKeys = [...new Set(formData.getAll("questionFigureKeys").filter((item): item is string => typeof item === "string"))];
  const solutionFigureKeys = [...new Set(formData.getAll("solutionFigureKeys").filter((item): item is string => typeof item === "string"))];
  if (!chapterId || content.length < 2 || content.length > 5000) return { error: "Chương hoặc nội dung câu hỏi không hợp lệ." } as const;
  if ((type === "MULTIPLE_CHOICE" || type === "TRUE_FALSE") && options.length < 2) return { error: "Loại câu này cần ít nhất hai lựa chọn/mệnh đề, mỗi dòng một mục." } as const;
  if (!correctAnswer || correctAnswer.length > 200) return { error: "Đáp án đúng không hợp lệ." } as const;
  if (type === "MULTIPLE_CHOICE" && (!/^[A-Z]$/.test(correctAnswer) || correctAnswer.charCodeAt(0) - 65 >= options.length)) return { error: "Đáp án trắc nghiệm phải khớp một lựa chọn (A, B, C…)." } as const;
  if (type === "TRUE_FALSE" && (correctAnswer.split(",").length !== options.length || correctAnswer.split(",").some((item) => item !== "D" && item !== "S"))) return { error: "Đáp án đúng/sai phải đủ từng mệnh đề, ví dụ D,S,D,S." } as const;
  if (classIds.length === 0) return { error: "Hãy giao câu hỏi cho ít nhất một lớp." } as const;
  return { data: { chapterId, content, type, difficulty, options, correctAnswer, grade: text(formData, "grade") || null, topic: text(formData, "topic") || null, textSolution: text(formData, "textSolution") || null, solutionImageUrl: text(formData, "solutionImageUrl") || null, videoUid: text(formData, "videoUid") || null, showSolution: checked(formData, "showSolution"), classIds, questionFigureKeys, solutionFigureKeys } } as const;
}

async function validateRelations(chapterId: string, classIds: string[]) {
  const [chapter, count] = await Promise.all([db.chapter.findUnique({ where: { id: chapterId }, select: { id: true } }), db.class.count({ where: { id: { in: classIds }, status: "ACTIVE" } })]);
  return Boolean(chapter) && count === classIds.length;
}

export async function createChapter(formData: FormData): Promise<Result> {
  try { await requireActiveAdminId(); const name = text(formData, "name"); const order = Number(text(formData, "order") || 0); if (name.length < 2 || name.length > 120 || !Number.isInteger(order)) return { success: false, error: "Thông tin chương không hợp lệ." }; await db.chapter.create({ data: { name, order } }); refresh(); return { success: true }; } catch (error) { console.error("createChapter thất bại:", error); return { success: false, error: "Không thể tạo chương." }; }
}

export async function searchQuestionBank(
  input: Record<string, string>,
): Promise<QuestionBankSearchResult> {
  try {
    const filters = parseReviewQuestionFilters(input);
    return { success: true, data: await getQuestionBankPage(filters) };
  } catch (error) {
    console.error("searchQuestionBank thất bại:", error);
    return { success: false, error: "Không thể tải ngân hàng câu hỏi." };
  }
}

export async function createReviewQuestion(formData: FormData): Promise<Result> {
  let storedImageKeys: string[] = [];
  try {
    await requireActiveAdminId(); const parsed = parseQuestion(formData); if ("error" in parsed) return { success: false, error: parsed.error ?? "Câu hỏi không hợp lệ." };
    const { classIds, questionFigureKeys, solutionFigureKeys, ...data } = parsed.data; if (!(await validateRelations(data.chapterId, classIds))) return { success: false, error: "Chương hoặc lớp không tồn tại/lớp đã lưu trữ." };
    const questionId = randomUUID();
    const images = await persistReviewQuestionFigures(questionId, questionFigureKeys, solutionFigureKeys);
    storedImageKeys = [...images.question, ...images.solution];
    await db.reviewQuestion.create({ data: { id: questionId, ...data, questionImageKeys: images.question, solutionImageKeys: images.solution, classLinks: { create: classIds.map((classId) => ({ classId })) } } }); refresh(data.chapterId); return { success: true };
  } catch (error) {
    await Promise.all(storedImageKeys.map((key) => deleteDocument(key).catch(() => undefined)));
    console.error("createReviewQuestion thất bại:", error);
    return { success: false, error: error instanceof ReviewQuestionImportError ? error.message : "Không thể tạo câu hỏi." };
  }
}

export async function updateReviewQuestion(questionId: string, formData: FormData): Promise<Result> {
  try {
    await requireActiveAdminId(); const parsed = parseQuestion(formData); if ("error" in parsed) return { success: false, error: parsed.error ?? "Câu hỏi không hợp lệ." };
    const current = await db.reviewQuestion.findUnique({ where: { id: questionId }, select: { chapterId: true } }); if (!current) return { success: false, error: "Không tìm thấy câu hỏi." };
    const { classIds, questionFigureKeys: _questionFigureKeys, solutionFigureKeys: _solutionFigureKeys, ...data } = parsed.data;
    void _questionFigureKeys; void _solutionFigureKeys;
    if (!(await validateRelations(data.chapterId, classIds))) return { success: false, error: "Chương hoặc lớp không tồn tại/lớp đã lưu trữ." };
    await db.$transaction([db.reviewQuestion.update({ where: { id: questionId }, data }), db.classReviewQuestion.deleteMany({ where: { questionId, classId: { notIn: classIds } } }), db.classReviewQuestion.createMany({ data: classIds.map((classId) => ({ questionId, classId })), skipDuplicates: true })]); refresh(current.chapterId); refresh(data.chapterId); return { success: true };
  } catch (error) { console.error("updateReviewQuestion thất bại:", error); return { success: false, error: "Không thể cập nhật câu hỏi." }; }
}

export async function answerReviewQuestion(questionId: string, selectedAnswer: string): Promise<ReviewAnswerResult> {
  try {
    const studentId = await requireActiveStudentId();
    const question = await db.reviewQuestion.findFirst({
      where: { id: questionId, classLinks: { some: { class: { enrollments: { some: { studentId } } } } } },
      select: { id: true, type: true, correctAnswer: true, textSolution: true, solutionImageUrl: true, solutionImageKeys: true, videoUid: true, videoUrl: true, showSolution: true },
    });
    if (!question) return { success: false, error: "Bạn không được giao câu hỏi này." };
    const normalized = normalize(selectedAnswer, question.type); if (!normalized || normalized.length > 200) return { success: false, error: "Câu trả lời không hợp lệ." };
    const correct = normalized === normalize(question.correctAnswer, question.type);
    await db.reviewAttempt.create({ data: { questionId, userId: studentId, selectedAnswer: normalized, isCorrect: correct } });
    const [attempts, correctAttempts] = await Promise.all([
      db.reviewAttempt.count({ where: { questionId, userId: studentId } }),
      db.reviewAttempt.count({ where: { questionId, userId: studentId, isCorrect: true } }),
    ]);
    let videoUrl: string | null = question.videoUrl;
    if (question.videoUid && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_STREAM_API_TOKEN) { try { videoUrl = buildStreamPlaybackUrl(question.videoUid, await getSignedStreamToken(question.videoUid)); } catch (error) { console.error("Không ký được video Stream:", error); } }
    const solutionImageUrls = question.showSolution && Array.isArray(question.solutionImageKeys)
      ? question.solutionImageKeys.flatMap((key, index) => typeof key === "string" ? [`/api/review-questions/${question.id}/assets/solution/${index}`] : [])
      : [];
    return { success: true, correct, solutionVisible: question.showSolution, correctAnswer: question.showSolution ? question.correctAnswer : "", textSolution: question.showSolution ? question.textSolution : null, solutionImageUrl: question.showSolution ? question.solutionImageUrl : null, solutionImageUrls, videoUrl: question.showSolution ? videoUrl : null, attempts, correctRate: attempts ? Math.round(correctAttempts / attempts * 100) : 0 };
  } catch (error) { console.error("answerReviewQuestion thất bại:", error); return { success: false, error: "Không thể chấm câu trả lời." }; }
}
