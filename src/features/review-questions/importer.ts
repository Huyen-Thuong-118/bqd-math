import "server-only";

import { requireActiveAdminId } from "@/features/exams/admin";
import {
  buildReviewQuestionImageKey,
  deleteDocument,
  uploadDocument,
} from "@/lib/storage";

import type {
  ImportedReviewQuestion,
  ImportedReviewQuestionType,
  ReviewQuestionImportResult,
} from "./import-types";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_IMPORTED_QUESTIONS = 200;
const IMPORT_TIMEOUT_MS = 5 * 60 * 1000;
const SNAPSHOT_KEY =
  /^[A-Za-z0-9_-]{8,120}\/source_questions\/q_\d{3}_page_\d{3}\.webp$/;
const FIGURE_KEY =
  /^[A-Za-z0-9_-]{8,120}\/figures\/q_\d{3}_figure_\d{2}\.webp$/;

type JsonRecord = Record<string, unknown>;

export class ReviewQuestionImportError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
    this.name = "ReviewQuestionImportError";
  }
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function values(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function strings(value: unknown): string[] {
  return values(value).filter((item): item is string => typeof item === "string");
}

function limitedText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function boundedText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function blockText(value: unknown): string {
  const block = record(value);
  if (!block) return "";
  if (block.type === "paragraph") {
    return values(block.children)
      .map((childValue) => {
        const child = record(childValue);
        if (!child) return "";
        if (child.type === "text") return boundedText(child.text, 10_000);
        if (child.type === "math_inline") {
          const latex = limitedText(child.latex, 10_000);
          return latex ? `$${latex}$` : "";
        }
        return "";
      })
      .join("")
      .trim();
  }
  if (block.type === "math_block") {
    const latex = limitedText(block.latex, 10_000);
    return latex ? `$$${latex}$$` : "";
  }
  if (block.type === "line_break") return "\n";
  if (block.type === "figure") return "";
  if (block.type === "table") {
    return values(block.rows)
      .map((rowValue) =>
        values(rowValue)
          .map((cellValue) => {
            const cell = record(cellValue);
            return blocksText(cell?.content);
          })
          .join("\t"),
      )
      .join("\n");
  }
  return "";
}

function blocksText(value: unknown): string {
  const parts = values(value)
    .map(blockText)
    .filter(Boolean);
  const combined = parts.reduce((output, part) => {
    if (!output) return part;
    return /^[.,;:!?)}\]]/.test(part) ? `${output}${part}` : `${output}\n${part}`;
  }, "");
  return combined
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function figureAssetIds(value: unknown): string[] {
  const result: string[] = [];
  for (const blockValue of values(value)) {
    const block = record(blockValue);
    if (!block) continue;
    if (block.type === "figure") {
      const assetId = limitedText(block.asset_id, 120);
      if (assetId) result.push(assetId);
    }
    if (block.type === "table") {
      for (const rowValue of values(block.rows)) {
        for (const cellValue of values(rowValue)) {
          result.push(...figureAssetIds(record(cellValue)?.content));
        }
      }
    }
  }
  return [...new Set(result)];
}

function questionType(question: JsonRecord): ImportedReviewQuestionType {
  if (question.type === "true_false") return "TRUE_FALSE";
  if (question.type === "short_answer") return "SHORT_ANSWER";
  if (question.type === "multiple_choice") return "MULTIPLE_CHOICE";
  if (values(question.statements).length >= 2) return "TRUE_FALSE";
  if (values(question.options).length >= 2) return "MULTIPLE_CHOICE";
  return "SHORT_ANSWER";
}

function questionOptions(
  question: JsonRecord,
  type: ImportedReviewQuestionType,
): string[] {
  if (type === "TRUE_FALSE") {
    return values(question.statements).flatMap((value, index) => {
      const statement = record(value);
      if (!statement) return [];
      const key = limitedText(statement.key, 4) || String.fromCharCode(97 + index);
      const content = blocksText(statement.content);
      return content ? [`${key}) ${content}`.slice(0, 1_000)] : [];
    });
  }
  if (type === "SHORT_ANSWER") return [];
  return values(question.options).flatMap((value, index) => {
    const option = record(value);
    if (!option) return [];
    const key = limitedText(option.key, 2) || String.fromCharCode(65 + index);
    const content = blocksText(option.content);
    return content ? [`${key}. ${content}`.slice(0, 1_000)] : [];
  });
}

function correctAnswer(
  question: JsonRecord,
  type: ImportedReviewQuestionType,
): string {
  if (type === "TRUE_FALSE") {
    const answers = values(question.statements).map((value) => {
      const answer = record(value)?.answer;
      return answer === true ? "D" : answer === false ? "S" : "";
    });
    return answers.length > 0 && answers.every(Boolean) ? answers.join(",") : "";
  }
  const answer = record(question.answer);
  if (!answer) return "";
  const value = limitedText(answer.value, 200);
  return type === "MULTIPLE_CHOICE"
    ? value.toUpperCase().replaceAll("Đ", "D")
    : value;
}

function overallConfidence(value: unknown): number {
  const confidence = record(value);
  if (!confidence) return 0;
  const weighted: Array<[number, number]> = [
    [Number(confidence.segmentation), 0.3],
    [Number(confidence.transcription), 0.3],
    [Number(confidence.structure), 0.2],
    [Number(confidence.figures), 0.2],
  ];
  if (confidence.answer !== null && confidence.answer !== undefined) {
    weighted.push([Number(confidence.answer), 0.15]);
  }
  const valid = weighted.filter(([score]) => Number.isFinite(score));
  if (!valid.length) return 0;
  const totalWeight = valid.reduce((sum, [, weight]) => sum + weight, 0);
  return Math.round(
    (valid.reduce((sum, [score, weight]) => sum + score * weight, 0) /
      totalWeight) *
      100,
  );
}

function encodeObjectKey(objectKey: string): string {
  return objectKey.split("/").map(encodeURIComponent).join("/");
}

function normalizeImportResponse(value: unknown): ReviewQuestionImportResult {
  const envelope = record(value);
  const result = record(envelope?.result);
  if (!envelope || !result) {
    throw new ReviewQuestionImportError(
      "Dịch vụ đọc PDF trả về dữ liệu không hợp lệ.",
      502,
    );
  }

  const documentId = limitedText(envelope.document_id, 120);
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(documentId)) {
    throw new ReviewQuestionImportError(
      "Dịch vụ đọc PDF không trả về mã tài liệu hợp lệ.",
      502,
    );
  }

  const snapshotsById = new Map<string, string>();
  const figuresById = new Map<string, string>();
  for (const value of values(result.assets)) {
    const asset = record(value);
    const id = limitedText(asset?.id, 120);
    const objectKey = limitedText(asset?.object_key, 300);
    if (id && SNAPSHOT_KEY.test(objectKey)) snapshotsById.set(id, objectKey);
    if (id && FIGURE_KEY.test(objectKey)) figuresById.set(id, objectKey);
  }

  const questions: ImportedReviewQuestion[] = [];
  for (const [index, value] of values(result.questions)
    .slice(0, MAX_IMPORTED_QUESTIONS)
    .entries()) {
    const question = record(value);
    if (!question) continue;
    const type = questionType(question);
    const snapshotUrls = strings(question.source_snapshot_assets).flatMap(
      (assetId) => {
        const objectKey = snapshotsById.get(assetId);
        return objectKey
          ? [`/api/review-questions/import/assets/${encodeObjectKey(objectKey)}`]
          : [];
      },
    );
    const toFigures = (blocks: unknown, role: "question" | "solution") =>
      figureAssetIds(blocks).flatMap((assetId, figureIndex) => {
        const objectKey = figuresById.get(assetId);
        return objectKey
          ? [{
              objectKey,
              url: `/api/review-questions/import/assets/${encodeObjectKey(objectKey)}`,
              alt: `Hình ${figureIndex + 1} trong ${role === "question" ? "đề bài" : "lời giải"} câu ${limitedText(question.number, 20) || index + 1}`,
            }]
          : [];
      });
    questions.push({
      id: limitedText(question.id, 180) || `${documentId}_q_${index + 1}`,
      number: limitedText(question.number, 20) || String(index + 1),
      type,
      content: blocksText(question.stem).slice(0, 5_000),
      options: questionOptions(question, type),
      correctAnswer: correctAnswer(question, type),
      textSolution: blocksText(question.solution).slice(0, 10_000),
      confidence: overallConfidence(question.confidence),
      warnings: strings(question.warnings).slice(0, 30),
      snapshotUrls,
      questionFigures: toFigures(question.stem, "question"),
      solutionFigures: toFigures(question.solution, "solution"),
    });
  }

  return {
    documentId,
    filename: limitedText(result.filename, 180) || "de-on-tap.pdf",
    pageCount: Math.max(0, Math.floor(Number(result.page_count) || 0)),
    warnings: strings(result.warnings).slice(0, 30),
    questions,
  };
}

function ocrServiceUrl(): string {
  const raw = process.env.OCR_SERVICE_URL?.trim() || "http://127.0.0.1:8001";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ReviewQuestionImportError(
      "OCR_SERVICE_URL chưa được cấu hình đúng.",
      503,
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ReviewQuestionImportError(
      "OCR_SERVICE_URL phải dùng HTTP hoặc HTTPS.",
      503,
    );
  }
  return url.toString().replace(/\/$/, "");
}

function safeFilename(name: string): string {
  return name.split(/[\\/]/).pop()?.slice(0, 180) || "de-on-tap.pdf";
}

async function requireReviewQuestionAdmin() {
  try {
    await requireActiveAdminId();
  } catch {
    throw new ReviewQuestionImportError("Bạn không có quyền nhập câu hỏi.", 403);
  }
}

export async function importReviewQuestionPdf(
  file: File,
): Promise<ReviewQuestionImportResult> {
  await requireReviewQuestionAdmin();
  if (!file.size) throw new ReviewQuestionImportError("Hãy chọn file PDF.", 400);
  if (file.size > MAX_PDF_BYTES) {
    throw new ReviewQuestionImportError("File PDF không được vượt quá 20 MB.", 413);
  }
  if (!file.name.toLocaleLowerCase("vi").endsWith(".pdf")) {
    throw new ReviewQuestionImportError("Tên file phải có đuôi .pdf.", 415);
  }
  if (file.type && file.type !== "application/pdf") {
    throw new ReviewQuestionImportError("Chỉ chấp nhận file PDF.", 415);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new ReviewQuestionImportError("Nội dung file không phải PDF.", 415);
  }
  const payload = new FormData();
  payload.set(
    "file",
    new Blob([bytes], { type: "application/pdf" }),
    safeFilename(file.name),
  );
  payload.set("debug", "false");

  let response: Response;
  try {
    response = await fetch(`${ocrServiceUrl()}/api/question-import`, {
      method: "POST",
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Không kết nối được dịch vụ import câu hỏi:", error);
    throw new ReviewQuestionImportError(
      "Không kết nối được dịch vụ đọc PDF. Hãy kiểm tra container OCR.",
      503,
    );
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = limitedText(record(json)?.detail, 500);
    throw new ReviewQuestionImportError(
      detail || "Dịch vụ OCR không xử lý được file PDF này.",
      response.status >= 500 ? 502 : 422,
    );
  }
  return normalizeImportResponse(json);
}

export async function readReviewImportSnapshot(
  objectKeyParts: string[],
): Promise<{ bytes: Uint8Array; contentType: string }> {
  await requireReviewQuestionAdmin();
  const objectKey = objectKeyParts.join("/");
  if (!SNAPSHOT_KEY.test(objectKey) && !FIGURE_KEY.test(objectKey)) {
    throw new ReviewQuestionImportError("Ảnh nguồn không hợp lệ.", 404);
  }
  const encoded = encodeObjectKey(objectKey);
  let response: Response;
  try {
    response = await fetch(
      `${ocrServiceUrl()}/api/question-import/assets/${encoded}`,
      { cache: "no-store", signal: AbortSignal.timeout(30_000) },
    );
  } catch (error) {
    console.error("Không tải được ảnh câu hỏi từ OCR:", error);
    throw new ReviewQuestionImportError("Không tải được ảnh câu hỏi.", 503);
  }
  if (!response.ok) {
    throw new ReviewQuestionImportError("Không tìm thấy ảnh câu hỏi.", 404);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
    throw new ReviewQuestionImportError("Ảnh câu hỏi không hợp lệ.", 422);
  }
  return { bytes, contentType: "image/webp" };
}

async function readImportFigure(objectKey: string): Promise<Uint8Array> {
  if (!FIGURE_KEY.test(objectKey)) {
    throw new ReviewQuestionImportError("Hình trích xuất không hợp lệ.", 422);
  }
  let response: Response;
  try {
    response = await fetch(
      `${ocrServiceUrl()}/api/question-import/assets/${encodeObjectKey(objectKey)}`,
      { cache: "no-store", signal: AbortSignal.timeout(30_000) },
    );
  } catch (error) {
    console.error("Không tải được hình trích xuất từ OCR:", error);
    throw new ReviewQuestionImportError("Không tải được hình trích xuất.", 503);
  }
  if (!response.ok) {
    throw new ReviewQuestionImportError("Hình trích xuất không còn tồn tại.", 422);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
    throw new ReviewQuestionImportError("Hình trích xuất không hợp lệ.", 422);
  }
  return bytes;
}

export async function persistReviewQuestionFigures(
  questionId: string,
  questionObjectKeys: string[],
  solutionObjectKeys: string[],
) {
  const groups = [
    { kind: "question" as const, objectKeys: [...new Set(questionObjectKeys)] },
    { kind: "solution" as const, objectKeys: [...new Set(solutionObjectKeys)] },
  ];
  if (groups.some((group) => group.objectKeys.length > 10)) {
    throw new ReviewQuestionImportError("Mỗi câu chỉ được có tối đa 10 hình.", 422);
  }
  const persisted = { question: [] as string[], solution: [] as string[] };
  try {
    for (const group of groups) {
      for (const [index, objectKey] of group.objectKeys.entries()) {
        const bytes = await readImportFigure(objectKey);
        const destination = buildReviewQuestionImageKey({
          questionId,
          kind: group.kind,
          index,
        });
        await uploadDocument(destination, Buffer.from(bytes), "image/webp");
        persisted[group.kind].push(destination);
      }
    }
  } catch (error) {
    await Promise.all(
      [...persisted.question, ...persisted.solution].map((key) =>
        deleteDocument(key).catch(() => undefined),
      ),
    );
    throw error;
  }
  return persisted;
}
