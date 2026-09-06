"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  buildExamDocumentKey,
  buildExamRevisionKey,
  deleteDocument,
  getDocumentMetadata,
  getSignedUploadUrl,
  isCloudStorageConfigured,
  readDocument,
  readDocumentPrefix,
  uploadDocument,
} from "@/lib/storage";
import { requireActiveAdminId } from "./admin";
import { analyzeExamPdfsWithGemini, hasGeminiConfig } from "./gemini";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const ADMIN_EXAMS_PATH = "/admin/de-thi";

type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
type ExamSection = { label: string; count: number; type: QuestionType };
type CreateExamResult =
  | { success: true; examId: string }
  | { success: false; error: string };
type SimpleResult = { success: true } | { success: false; error: string };
type UpdateExamResult = { success: true } | { success: false; error: string };
type AnalyzeResult =
  | {
      success: true;
      sections: ExamSection[];
      pageCount: number;
      ocrPageCount: number;
      answerKey: string[] | null;
      answerDetectedCount: number;
      analysisSource: "GEMINI" | "OCR_FALLBACK";
    }
  | { success: false; error: string };
type UploadTargetResult =
  | { success: true; key: string; uploadUrl: string }
  | { success: false; error: string };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function parsePositiveInteger(value: string, nullable = false) {
  if (!value && nullable) return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function parsePositiveNumber(value: string, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 100 ? number : fallback;
}

function parseSections(raw: string): ExamSection[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.some(
        (section) =>
          !section ||
          typeof section.label !== "string" ||
          !section.label.trim() ||
          !["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"].includes(section.type) ||
          !Number.isInteger(section.count) ||
          section.count <= 0,
      )
    ) {
      return null;
    }
    return value.map((section) => ({
      label: String(section.label).trim(),
      count: Number(section.count),
      type: section.type as QuestionType,
    }));
  } catch {
    return null;
  }
}

function answerMatchesType(answer: string, type: QuestionType) {
  if (type === "MULTIPLE_CHOICE") return /^[ABCD]$/.test(answer);
  if (type === "TRUE_FALSE") return /^[DS](,[DS]){3}$/.test(answer);
  return answer.length > 0 && answer.length <= 50;
}

function validatePdf(value: FormDataEntryValue | null, required: boolean) {
  if (!(value instanceof File) || value.size === 0) {
    return required ? "Vui lòng chọn file PDF đề thi." : null;
  }
  if (value.size > MAX_PDF_BYTES) return "Mỗi file PDF không được vượt quá 20 MB.";
  if (value.type && value.type !== "application/pdf") return "Chỉ chấp nhận file PDF.";
  if (!value.name.toLowerCase().endsWith(".pdf")) return "Tên file phải có đuôi .pdf.";
  return null;
}

function validUploadId(value: string) {
  return /^[a-z0-9-]{10,100}$/i.test(value);
}

function isExpectedExamKey(key: string, examId: string, kind: "exam" | "answer", revision = false) {
  const stem = kind === "exam" ? "de" : "dapan";
  if (!revision) return key === `exams/${examId}/${stem}.pdf`;
  const prefix = `exams/${examId}/${stem}-`;
  if (!key.startsWith(prefix) || !key.endsWith(".pdf")) return false;
  return validUploadId(key.slice(prefix.length, -4));
}

async function verifyStoredPdf(key: string) {
  const [metadata, prefix] = await Promise.all([
    getDocumentMetadata(key),
    readDocumentPrefix(key, 5),
  ]);
  if (metadata.size <= 0 || metadata.size > MAX_PDF_BYTES) {
    throw new Error("File PDF rỗng hoặc vượt quá 20 MB.");
  }
  if (metadata.contentType && metadata.contentType !== "application/pdf") {
    throw new Error("File tải lên không có định dạng PDF.");
  }
  if (!Buffer.from(prefix).equals(Buffer.from("%PDF-"))) {
    throw new Error("Nội dung file tải lên không phải PDF hợp lệ.");
  }
}

export async function prepareExamUpload(
  examId: string,
  kind: "exam" | "answer",
  fileName: string,
  fileSize: number,
  revisionId?: string,
): Promise<UploadTargetResult> {
  try {
    await requireActiveAdminId();
    if (!isCloudStorageConfigured()) {
      return { success: false, error: "Google Cloud Storage chưa được cấu hình đầy đủ." };
    }
    if (
      !validUploadId(examId) ||
      (revisionId !== undefined && !validUploadId(revisionId)) ||
      !fileName.toLowerCase().endsWith(".pdf") ||
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_PDF_BYTES
    ) {
      return { success: false, error: "Thông tin file PDF không hợp lệ." };
    }
    const existing = await db.exam.findUnique({ where: { id: examId }, select: { id: true } });
    if (revisionId && !existing) return { success: false, error: "Không tìm thấy đề thi." };
    if (!revisionId && existing) return { success: false, error: "Mã đề tải lên đã tồn tại." };
    const key = revisionId
      ? buildExamRevisionKey({ examId, kind: kind === "exam" ? "de" : "dapan", revisionId })
      : buildExamDocumentKey({ examId, filename: kind === "exam" ? "de.pdf" : "dapan.pdf" });
    const uploadUrl = await getSignedUploadUrl(key, "application/pdf");
    return { success: true, key, uploadUrl };
  } catch (error) {
    console.error("prepareExamUpload thất bại:", error);
    return { success: false, error: "Không thể tạo đường dẫn upload an toàn." };
  }
}

export async function discardExamUpload(examId: string, key: string): Promise<SimpleResult> {
  try {
    await requireActiveAdminId();
    if (
      !validUploadId(examId) ||
      !(
        isExpectedExamKey(key, examId, "exam") ||
        isExpectedExamKey(key, examId, "answer") ||
        isExpectedExamKey(key, examId, "exam", true) ||
        isExpectedExamKey(key, examId, "answer", true)
      )
    ) {
      return { success: false, error: "Đường dẫn file cần dọn dẹp không hợp lệ." };
    }
    const referenced = await db.exam.findFirst({
      where: { OR: [{ examFileUrl: key }, { answerFileUrl: key }] },
      select: { id: true },
    });
    if (referenced) return { success: false, error: "File đang được một đề thi sử dụng." };
    await deleteDocument(key);
    return { success: true };
  } catch (error) {
    console.error("discardExamUpload thất bại:", error);
    return { success: false, error: "Không thể dọn dẹp file upload." };
  }
}

export async function analyzeExamPdf(formData: FormData): Promise<AnalyzeResult> {
  try {
    await requireActiveAdminId();
    const file = formData.get("examPdf");
    const answerFile = formData.get("answerPdf");
    const examKey = text(formData, "examPdfKey");
    const answerStorageKey = text(formData, "answerPdfKey");
    const examId = text(formData, "examId");
    let bytes: Buffer;
    let examFileName = "de.pdf";
    if (examKey) {
      if (!validUploadId(examId) || !isExpectedExamKey(examKey, examId, "exam")) {
        return { success: false, error: "Đường dẫn file đề không hợp lệ." };
      }
      await verifyStoredPdf(examKey);
      bytes = Buffer.from(await readDocument(examKey));
    } else {
      const error = validatePdf(file, true);
      if (error || !(file instanceof File)) {
        return { success: false, error: error ?? "File đề không hợp lệ." };
      }
      examFileName = file.name;
      bytes = Buffer.from(await file.arrayBuffer());
      if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
        return { success: false, error: "File đề không phải PDF hợp lệ." };
      }
    }
    let answerBytes: Buffer | undefined;
    let answerFileName = "dapan.pdf";
    if (answerStorageKey) {
      if (!validUploadId(examId) || !isExpectedExamKey(answerStorageKey, examId, "answer")) {
        return { success: false, error: "Đường dẫn file lời giải không hợp lệ." };
      }
      await verifyStoredPdf(answerStorageKey);
      answerBytes = Buffer.from(await readDocument(answerStorageKey));
    } else if (answerFile instanceof File && answerFile.size > 0) {
      const answerError = validatePdf(answerFile, false);
      if (answerError) return { success: false, error: answerError };
      answerFileName = answerFile.name;
      answerBytes = Buffer.from(await answerFile.arrayBuffer());
      if (!answerBytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
        return { success: false, error: "File lời giải không phải PDF hợp lệ." };
      }
    }

    let geminiError: string | undefined;
    if (hasGeminiConfig()) {
      try {
        const gemini = await analyzeExamPdfsWithGemini(bytes, answerBytes);
        const sections = parseSections(JSON.stringify(gemini.sections));
        if (!sections) throw new Error("Gemini trả về cấu trúc đề không hợp lệ.");
        const expectedCount = sections.reduce((sum, section) => sum + section.count, 0);
        const questionTypes = sections.flatMap((section) =>
          Array(section.count).fill(section.type) as QuestionType[],
        );
        const validAnswerCount = gemini.answerKey.filter((answer, index) =>
          answerMatchesType(answer, questionTypes[index] ?? "SHORT_ANSWER"),
        ).length;
        const completeAnswerKey = gemini.answerKey.length === expectedCount && validAnswerCount === expectedCount
          ? gemini.answerKey
          : null;
        if (!answerBytes || completeAnswerKey) {
          return {
            success: true,
            sections,
            pageCount: gemini.pageCount,
            ocrPageCount: 0,
            answerKey: completeAnswerKey,
            answerDetectedCount: validAnswerCount,
            analysisSource: "GEMINI",
          };
        }
        geminiError = `Gemini chỉ nhận được ${validAnswerCount}/${expectedCount} đáp án hợp lệ.`;
      } catch (error) {
        geminiError = error instanceof Error ? error.message : "Gemini không xử lý được PDF.";
        console.warn("Vertex AI Gemini thất bại, chuyển sang OCR local:", geminiError);
      }
    } else {
      geminiError = "Chưa cấu hình Vertex AI (GOOGLE_CLOUD_PROJECT).";
    }

    const ocrServiceUrl = process.env.OCR_SERVICE_URL?.trim();
    const localOcrUnavailable =
      !ocrServiceUrl || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(ocrServiceUrl);
    if (process.env.NODE_ENV === "production" && localOcrUnavailable) {
      return {
        success: false,
        error: `${geminiError ?? "Gemini không xử lý được PDF"} Không có dịch vụ OCR dự phòng trên production.`,
      };
    }

    const payload = new FormData();
    payload.set("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), examFileName);
    const response = await fetch(
      `${ocrServiceUrl || "http://127.0.0.1:8001"}/analyze`,
      { method: "POST", body: payload, signal: AbortSignal.timeout(120_000) },
    );
    const result = (await response.json().catch(() => null)) as
      | { detail?: string; sections?: unknown; pageCount?: number; ocrPages?: number[] }
      | null;
    if (!response.ok) {
      return {
        success: false,
        error: `${geminiError ?? "Gemini không dùng được"} OCR fallback: ${result?.detail ?? "không xử lý được file."}`,
      };
    }
    const sections = parseSections(JSON.stringify(result?.sections));
    if (!sections) return { success: false, error: "OCR trả về cấu trúc đề không hợp lệ." };

    let answerKey: string[] | null = null;
    let answerDetectedCount = 0;
    if (answerBytes) {
      const answerPayload = new FormData();
      answerPayload.set(
        "file",
        new Blob([new Uint8Array(answerBytes)], { type: "application/pdf" }),
        answerFileName,
      );
      const answerResponse = await fetch(
        `${ocrServiceUrl || "http://127.0.0.1:8001"}/analyze-answer`,
        { method: "POST", body: answerPayload, signal: AbortSignal.timeout(120_000) },
      );
      const answerResult = (await answerResponse.json().catch(() => null)) as
        | { answerKey?: unknown; complete?: boolean }
        | null;
      if (answerResponse.ok && Array.isArray(answerResult?.answerKey)) {
        const detected = answerResult.answerKey.filter((item): item is string => typeof item === "string");
        answerDetectedCount = detected.length;
        if (answerResult.complete && detected.length === sections.reduce((sum, section) => sum + section.count, 0)) {
          answerKey = detected;
        }
      }
    }
    return {
      success: true,
      sections,
      pageCount: result?.pageCount ?? 0,
      ocrPageCount: result?.ocrPages?.length ?? 0,
      answerKey,
      answerDetectedCount,
      analysisSource: "OCR_FALLBACK",
    };
  } catch (error) {
    console.error("analyzeExamPdf thất bại:", error);
    return {
      success: false,
      error: error instanceof Error
        ? `Không phân tích được PDF: ${error.message}`
        : "Không phân tích được PDF bằng Gemini hoặc OCR local.",
    };
  }
}

export async function createExam(formData: FormData): Promise<CreateExamResult> {
  let examKey: string | undefined;
  let answerKeyFile: string | undefined;
  try {
    await requireActiveAdminId();
    const title = text(formData, "title");
    const mode = text(formData, "mode") === "PRACTICE" ? "PRACTICE" : "MOCK";
    const isForever = checked(formData, "isForever");
    const durationMinutes = parsePositiveInteger(
      text(formData, "durationMinutes"),
      mode === "PRACTICE",
    );
    const maxAttempts = parsePositiveInteger(text(formData, "maxAttempts"), true);
    const availableFromRaw = text(formData, "availableFrom");
    const availableToRaw = text(formData, "availableTo");
    const availableFrom = !isForever && availableFromRaw ? new Date(availableFromRaw) : null;
    const availableTo = !isForever && availableToRaw ? new Date(availableToRaw) : null;
    const sections = parseSections(text(formData, "sections"));
    const classIds = formData
      .getAll("classIds")
      .filter((value): value is string => typeof value === "string");
    const examPdf = formData.get("examPdf");
    const answerPdf = formData.get("answerPdf");
    const directExamKey = text(formData, "examPdfKey");
    const directAnswerKey = text(formData, "answerPdfKey");
    const publishNow = checked(formData, "publishNow");
    const pointByType = {
      MULTIPLE_CHOICE: parsePositiveNumber(text(formData, "multipleChoicePoints"), 0.25),
      TRUE_FALSE: parsePositiveNumber(text(formData, "trueFalsePoints"), 1),
      SHORT_ANSWER: parsePositiveNumber(text(formData, "shortAnswerPoints"), 0.5),
    };
    const trueFalseFractions = text(formData, "trueFalsePolicy") === "ALL_OR_NOTHING"
      ? [0, 0, 0, 0, 1]
      : [0, 0.1, 0.25, 0.5, 1];

    if (title.length < 3 || title.length > 150) {
      return { success: false, error: "Tên đề phải có từ 3 đến 150 ký tự." };
    }
    if (!directExamKey) {
      const examPdfError = validatePdf(examPdf, true);
      if (examPdfError) return { success: false, error: examPdfError };
    }
    if (!directAnswerKey) {
      const answerPdfError = validatePdf(answerPdf, false);
      if (answerPdfError) return { success: false, error: answerPdfError };
    }
    if (!sections) return { success: false, error: "Cấu hình phiếu tô không hợp lệ." };
    const questionCount = sections.reduce((sum, section) => sum + section.count, 0);
    if (questionCount > 200) {
      return { success: false, error: "Một đề tối đa 200 câu trong phiên bản hiện tại." };
    }
    if (mode === "MOCK" && durationMinutes === undefined) {
      return { success: false, error: "Thời lượng thi phải là số nguyên dương." };
    }
    if (maxAttempts === undefined) {
      return { success: false, error: "Số lượt làm không hợp lệ." };
    }
    if (
      (!isForever && (!availableFrom || !availableTo)) ||
      (availableFrom && Number.isNaN(availableFrom.getTime())) ||
      (availableTo && Number.isNaN(availableTo.getTime())) ||
      (availableFrom && availableTo && availableFrom >= availableTo)
    ) {
      return { success: false, error: "Khung thời gian giao đề không hợp lệ." };
    }
    if (classIds.length === 0) {
      return { success: false, error: "Hãy giao đề cho ít nhất một lớp." };
    }

    let answers: unknown;
    try {
      answers = JSON.parse(text(formData, "answerKey"));
    } catch {
      answers = null;
    }
    const questionTypes = sections.flatMap((section) => Array(section.count).fill(section.type) as QuestionType[]);
    if (!Array.isArray(answers) || answers.length !== questionCount) {
      return { success: false, error: "Vui lòng nhập đủ đáp án cho mọi câu." };
    }
    const invalidAnswer = answers.some((answer, index) => {
      if (typeof answer !== "string" || !answer.trim() || answer.length > 50) return true;
      if (questionTypes[index] === "MULTIPLE_CHOICE") return !["A", "B", "C", "D"].includes(answer);
      if (questionTypes[index] === "TRUE_FALSE") return !/^[DS](,[DS]){3}$/.test(answer);
      return false;
    });
    if (invalidAnswer) {
      return { success: false, error: "Đáp án không đúng định dạng của phiếu tô." };
    }

    const existingClassCount = await db.class.count({
      where: { id: { in: [...new Set(classIds)] }, status: "ACTIVE" },
    });
    if (existingClassCount !== new Set(classIds).size) {
      return { success: false, error: "Có lớp không tồn tại hoặc đã lưu trữ." };
    }

    const requestedExamId = text(formData, "examId");
    const examId = requestedExamId || randomUUID();
    if (!validUploadId(examId)) return { success: false, error: "Mã đề không hợp lệ." };
    if (await db.exam.findUnique({ where: { id: examId }, select: { id: true } })) {
      return { success: false, error: "Mã đề đã tồn tại, vui lòng tải file lại." };
    }
    examKey = directExamKey || buildExamDocumentKey({ examId, filename: "de.pdf" });
    if (directExamKey) {
      if (!isExpectedExamKey(directExamKey, examId, "exam")) {
        return { success: false, error: "Đường dẫn file đề không hợp lệ." };
      }
      await verifyStoredPdf(directExamKey);
    } else {
      const examBytes = Buffer.from(await (examPdf as File).arrayBuffer());
      if (!examBytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
        return { success: false, error: "File đề không phải PDF hợp lệ." };
      }
      await uploadDocument(examKey, examBytes);
    }
    answerKeyFile = directAnswerKey || (
      answerPdf instanceof File && answerPdf.size > 0
        ? buildExamDocumentKey({ examId, filename: "dapan.pdf" })
        : undefined
    );
    if (directAnswerKey) {
      if (!isExpectedExamKey(directAnswerKey, examId, "answer")) {
        return { success: false, error: "Đường dẫn file lời giải không hợp lệ." };
      }
      await verifyStoredPdf(directAnswerKey);
    } else if (answerKeyFile && answerPdf instanceof File) {
      const answerBytes = Buffer.from(await answerPdf.arrayBuffer());
      if (!answerBytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
        await deleteDocument(examKey);
        return { success: false, error: "File lời giải không phải PDF hợp lệ." };
      }
      await uploadDocument(answerKeyFile, answerBytes);
    }

    await db.exam.create({
      data: {
        id: examId,
        title,
        mode,
        status: publishNow ? "PUBLISHED" : "DRAFT",
        publishedAt: publishNow ? new Date() : null,
        scoringPolicy: { trueFalseFractions, pointByType },
        examFileUrl: examKey,
        answerFileUrl: answerKeyFile,
        showAnswer: Boolean(answerKeyFile) && checked(formData, "showAnswer"),
        isForever,
        availableFrom,
        availableTo,
        durationMinutes: durationMinutes ?? null,
        maxAttempts: maxAttempts ?? null,
        allowDownload: checked(formData, "allowDownload"),
        hideWrongAnswers: checked(formData, "hideWrongAnswers"),
        answerSheetConfig: sections,
        examLinks: {
          create: [...new Set(classIds)].map((classId) => ({ classId })),
        },
        questions: {
          create: (answers as string[]).map((correctAnswer, index) => ({
            number: index + 1,
            content: `Câu ${index + 1} — xem nội dung trong file đề`,
            type: questionTypes[index],
            options:
              questionTypes[index] === "MULTIPLE_CHOICE"
                ? ["A", "B", "C", "D"]
                : questionTypes[index] === "TRUE_FALSE"
                  ? ["a", "b", "c", "d"]
                  : [],
            correctAnswer: correctAnswer.trim().toUpperCase(),
            points: pointByType[questionTypes[index]],
          })),
        },
      },
    });
    revalidatePath(ADMIN_EXAMS_PATH);
    return { success: true, examId };
  } catch (error) {
    console.error("createExam thất bại:", error);
    if (examKey) await deleteDocument(examKey).catch(() => undefined);
    if (answerKeyFile) await deleteDocument(answerKeyFile).catch(() => undefined);
    return { success: false, error: "Không thể tạo đề, vui lòng thử lại." };
  }
}

export async function createExamFromQuestionBank(formData: FormData): Promise<CreateExamResult> {
  try {
    await requireActiveAdminId();
    const title = text(formData, "title");
    const mode = text(formData, "mode") === "PRACTICE" ? "PRACTICE" : "MOCK";
    const durationMinutes = parsePositiveInteger(text(formData, "durationMinutes"), mode === "PRACTICE");
    const maxAttempts = parsePositiveInteger(text(formData, "maxAttempts"), true);
    const classIds = [...new Set(formData.getAll("classIds").filter((item): item is string => typeof item === "string"))];
    const questionIds = [...new Set(formData.getAll("questionIds").filter((item): item is string => typeof item === "string"))];
    if (title.length < 3 || title.length > 150) return { success: false, error: "Tên đề phải có từ 3 đến 150 ký tự." };
    if (!classIds.length || !questionIds.length || questionIds.length > 200) return { success: false, error: "Hãy chọn lớp và từ 1 đến 200 câu hỏi." };
    if (mode === "MOCK" && durationMinutes === undefined) return { success: false, error: "Thời lượng phải là số nguyên dương." };
    if (maxAttempts === undefined) return { success: false, error: "Số lượt làm không hợp lệ." };
    const [classCount, questions] = await Promise.all([
      db.class.count({ where: { id: { in: classIds }, status: "ACTIVE" } }),
      db.reviewQuestion.findMany({ where: { id: { in: questionIds } }, select: { id: true, content: true, type: true, options: true, correctAnswer: true, textSolution: true } }),
    ]);
    if (classCount !== classIds.length || questions.length !== questionIds.length) return { success: false, error: "Có lớp hoặc câu hỏi không còn hợp lệ." };
    const byId = new Map(questions.map((question) => [question.id, question]));
    const ordered = questionIds.map((id) => byId.get(id)!);
    const publishNow = checked(formData, "publishNow");
    const pointByType = { MULTIPLE_CHOICE: parsePositiveNumber(text(formData, "multipleChoicePoints"), 0.25), TRUE_FALSE: parsePositiveNumber(text(formData, "trueFalsePoints"), 1), SHORT_ANSWER: parsePositiveNumber(text(formData, "shortAnswerPoints"), 0.5) };
    const exam = await db.exam.create({ data: { title, mode, examFileUrl: "", durationMinutes: durationMinutes ?? null, maxAttempts: maxAttempts ?? null, status: publishNow ? "PUBLISHED" : "DRAFT", publishedAt: publishNow ? new Date() : null, isForever: true, scoringPolicy: { trueFalseFractions: [0, 0.1, 0.25, 0.5, 1], pointByType }, examLinks: { create: classIds.map((classId) => ({ classId })) }, questions: { create: ordered.map((question, index) => ({ number: index + 1, content: question.content, type: question.type, options: Array.isArray(question.options) ? question.options.filter((item): item is string => typeof item === "string") : [], correctAnswer: question.correctAnswer, explanation: question.textSolution, points: pointByType[question.type] })) } }, select: { id: true } });
    revalidatePath(ADMIN_EXAMS_PATH); revalidatePath("/thi-thu");
    return { success: true, examId: exam.id };
  } catch (error) { console.error("createExamFromQuestionBank thất bại:", error); return { success: false, error: "Không thể tạo đề từ ngân hàng câu hỏi." }; }
}

export async function updateExam(examId: string, formData: FormData): Promise<UpdateExamResult> {
  let uploadedExamKey: string | undefined;
  let uploadedAnswerKey: string | undefined;
  try {
    await requireActiveAdminId();
    const current = await db.exam.findUnique({
      where: { id: examId },
      select: {
        examFileUrl: true,
        answerFileUrl: true,
        questions: { select: { id: true, type: true }, orderBy: { number: "asc" } },
      },
    });
    if (!current) return { success: false, error: "Không tìm thấy đề thi." };

    const title = text(formData, "title");
    const mode = text(formData, "mode") === "PRACTICE" ? "PRACTICE" : "MOCK";
    const isForever = checked(formData, "isForever");
    const durationMinutes = parsePositiveInteger(text(formData, "durationMinutes"), mode === "PRACTICE");
    const maxAttempts = parsePositiveInteger(text(formData, "maxAttempts"), true);
    const availableFromRaw = text(formData, "availableFrom");
    const availableToRaw = text(formData, "availableTo");
    const availableFrom = !isForever && availableFromRaw ? new Date(availableFromRaw) : null;
    const availableTo = !isForever && availableToRaw ? new Date(availableToRaw) : null;
    const classIds = [...new Set(formData.getAll("classIds").filter((item): item is string => typeof item === "string"))];
    const examPdf = formData.get("examPdf");
    const answerPdf = formData.get("answerPdf");
    const directExamKey = text(formData, "examPdfKey");
    const directAnswerKey = text(formData, "answerPdfKey");
    const removeSolution = checked(formData, "removeSolution");
    const pointByType = {
      MULTIPLE_CHOICE: parsePositiveNumber(text(formData, "multipleChoicePoints"), 0.25),
      TRUE_FALSE: parsePositiveNumber(text(formData, "trueFalsePoints"), 1),
      SHORT_ANSWER: parsePositiveNumber(text(formData, "shortAnswerPoints"), 0.5),
    };
    const trueFalseFractions = text(formData, "trueFalsePolicy") === "ALL_OR_NOTHING"
      ? [0, 0, 0, 0, 1]
      : [0, 0.1, 0.25, 0.5, 1];

    if (title.length < 3 || title.length > 150) return { success: false, error: "Tên đề phải có từ 3 đến 150 ký tự." };
    if (!classIds.length) return { success: false, error: "Hãy giao đề cho ít nhất một lớp." };
    if (mode === "MOCK" && durationMinutes === undefined) return { success: false, error: "Thời lượng thi phải là số nguyên dương." };
    if (maxAttempts === undefined) return { success: false, error: "Số lượt làm không hợp lệ." };
    if ((!isForever && (!availableFrom || !availableTo)) || (availableFrom && Number.isNaN(availableFrom.getTime())) || (availableTo && Number.isNaN(availableTo.getTime())) || (availableFrom && availableTo && availableFrom >= availableTo)) {
      return { success: false, error: "Khung thời gian giao đề không hợp lệ." };
    }
    if (!directExamKey) {
      const examPdfError = validatePdf(examPdf, false);
      if (examPdfError) return { success: false, error: examPdfError };
    }
    if (!directAnswerKey) {
      const answerPdfError = validatePdf(answerPdf, false);
      if (answerPdfError) return { success: false, error: answerPdfError };
    }
    if (removeSolution && (directAnswerKey || (answerPdf instanceof File && answerPdf.size > 0))) {
      return { success: false, error: "Chỉ chọn thay file lời giải hoặc xóa lời giải, không chọn cả hai." };
    }

    let answers: unknown;
    try { answers = JSON.parse(text(formData, "answerKey")); } catch { answers = null; }
    if (!Array.isArray(answers) || answers.length !== current.questions.length) {
      return { success: false, error: "Vui lòng nhập đủ đáp án cho mọi câu." };
    }
    const invalidAnswer = answers.some((answer, index) => typeof answer !== "string" || !answerMatchesType(answer.trim().toUpperCase(), current.questions[index].type));
    if (invalidAnswer) return { success: false, error: "Đáp án không đúng định dạng của từng loại câu hỏi." };

    const classCount = await db.class.count({ where: { id: { in: classIds }, status: "ACTIVE" } });
    if (classCount !== classIds.length) return { success: false, error: "Có lớp không tồn tại hoặc đã lưu trữ." };

    if (directExamKey) {
      if (!isExpectedExamKey(directExamKey, examId, "exam", true)) {
        return { success: false, error: "Đường dẫn phiên bản file đề không hợp lệ." };
      }
      await verifyStoredPdf(directExamKey);
      uploadedExamKey = directExamKey;
    } else if (examPdf instanceof File && examPdf.size > 0) {
      const bytes = Buffer.from(await examPdf.arrayBuffer());
      if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) return { success: false, error: "File đề không phải PDF hợp lệ." };
      uploadedExamKey = buildExamRevisionKey({ examId, kind: "de", revisionId: randomUUID() });
      await uploadDocument(uploadedExamKey, bytes);
    }
    if (directAnswerKey) {
      if (!isExpectedExamKey(directAnswerKey, examId, "answer", true)) {
        if (uploadedExamKey) await deleteDocument(uploadedExamKey).catch(() => undefined);
        return { success: false, error: "Đường dẫn phiên bản file lời giải không hợp lệ." };
      }
      await verifyStoredPdf(directAnswerKey);
      uploadedAnswerKey = directAnswerKey;
    } else if (answerPdf instanceof File && answerPdf.size > 0) {
      const bytes = Buffer.from(await answerPdf.arrayBuffer());
      if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
        if (uploadedExamKey) {
          await deleteDocument(uploadedExamKey).catch(() => undefined);
          uploadedExamKey = undefined;
        }
        return { success: false, error: "File lời giải không phải PDF hợp lệ." };
      }
      uploadedAnswerKey = buildExamRevisionKey({ examId, kind: "dapan", revisionId: randomUUID() });
      await uploadDocument(uploadedAnswerKey, bytes);
    }
    const nextAnswerUrl = uploadedAnswerKey ?? (removeSolution ? null : current.answerFileUrl);

    await db.$transaction([
      db.exam.update({
        where: { id: examId },
        data: {
          title,
          mode,
          examFileUrl: uploadedExamKey ?? current.examFileUrl,
          answerFileUrl: nextAnswerUrl,
          showAnswer: Boolean(nextAnswerUrl) && checked(formData, "showAnswer"),
          isForever,
          availableFrom,
          availableTo,
          durationMinutes: durationMinutes ?? null,
          maxAttempts: maxAttempts ?? null,
          allowDownload: checked(formData, "allowDownload"),
          hideWrongAnswers: checked(formData, "hideWrongAnswers"),
          scoringPolicy: { trueFalseFractions, pointByType },
          examLinks: { deleteMany: {}, create: classIds.map((classId) => ({ classId })) },
        },
      }),
      ...current.questions.map((question, index) => db.examQuestion.update({
        where: { id: question.id },
        data: {
          correctAnswer: String(answers[index]).trim().toUpperCase(),
          points: pointByType[question.type],
        },
      })),
    ]);

    if (uploadedExamKey && current.examFileUrl) await deleteDocument(current.examFileUrl).catch(() => undefined);
    if ((uploadedAnswerKey || removeSolution) && current.answerFileUrl) await deleteDocument(current.answerFileUrl).catch(() => undefined);
    revalidatePath(ADMIN_EXAMS_PATH);
    revalidatePath(`${ADMIN_EXAMS_PATH}/${examId}/chinh-sua`);
    revalidatePath("/thi-thu");
    revalidatePath(`/thi-thu/${examId}`);
    return { success: true };
  } catch (error) {
    console.error("updateExam thất bại:", error);
    if (uploadedExamKey) await deleteDocument(uploadedExamKey).catch(() => undefined);
    if (uploadedAnswerKey) await deleteDocument(uploadedAnswerKey).catch(() => undefined);
    return { success: false, error: "Không thể cập nhật đề thi." };
  }
}

export async function toggleExamSolution(examId: string): Promise<SimpleResult> {
  try {
    await requireActiveAdminId();
    const exam = await db.exam.findUnique({
      where: { id: examId },
      select: { answerFileUrl: true, showAnswer: true },
    });
    if (!exam?.answerFileUrl) {
      return { success: false, error: "Đề chưa có file lời giải." };
    }
    await db.exam.update({
      where: { id: examId },
      data: { showAnswer: !exam.showAnswer },
    });
    revalidatePath(ADMIN_EXAMS_PATH);
    return { success: true };
  } catch (error) {
    console.error("toggleExamSolution thất bại:", error);
    return { success: false, error: "Không thể đổi trạng thái lời giải." };
  }
}

export async function closeExam(examId: string): Promise<SimpleResult> {
  try {
    await requireActiveAdminId();
    await db.exam.update({
      where: { id: examId },
      data: { status: "CLOSED", isForever: false, availableTo: new Date() },
    });
    revalidatePath(ADMIN_EXAMS_PATH);
    return { success: true };
  } catch (error) {
    console.error("closeExam thất bại:", error);
    return { success: false, error: "Không thể đóng đề." };
  }
}


export async function publishExam(examId: string): Promise<SimpleResult> {
  try {
    await requireActiveAdminId();
    const exam = await db.exam.findUnique({ where: { id: examId }, select: { status: true, _count: { select: { questions: true, examLinks: true } } } });
    if (!exam) return { success: false, error: "Không tìm thấy đề." };
    if (!exam._count.questions || !exam._count.examLinks) return { success: false, error: "Đề phải có câu hỏi và ít nhất một lớp trước khi xuất bản." };
    await db.exam.update({ where: { id: examId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    revalidatePath(ADMIN_EXAMS_PATH); revalidatePath("/thi-thu");
    return { success: true };
  } catch (error) { console.error("publishExam thất bại:", error); return { success: false, error: "Không thể xuất bản đề." }; }
}
