"use client";

import { prepareExamUpload } from "../admin-actions";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function validatePdfForUpload(file: File) {
  if (!file.size) return "File PDF đang rỗng.";
  if (file.size > MAX_PDF_BYTES) return "Mỗi file PDF không được vượt quá 20 MB.";
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Tên file phải có đuôi .pdf.";
  if (file.type && file.type !== "application/pdf") return "Chỉ chấp nhận file PDF.";
  return null;
}

export async function uploadExamPdf(params: {
  examId: string;
  kind: "exam" | "answer";
  file: File;
  revisionId?: string;
}) {
  const validationError = validatePdfForUpload(params.file);
  if (validationError) throw new Error(validationError);
  const target = await prepareExamUpload(
    params.examId,
    params.kind,
    params.file.name,
    params.file.size,
    params.revisionId,
  );
  if (!target.success) throw new Error(target.error);
  const response = await fetch(target.uploadUrl, {
    method: "PUT",
    body: params.file,
    headers: { "Content-Type": "application/pdf" },
  });
  if (!response.ok) {
    throw new Error(`Cloudflare R2 từ chối file upload (HTTP ${response.status}).`);
  }
  return target.key;
}

