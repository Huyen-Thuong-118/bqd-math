import "server-only";

import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const LOCAL_STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

function getR2Client() {
  if (!isR2Configured()) throw new Error("Cloudflare R2 chưa được cấu hình.");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function safeStorageKey(key: string) {
  const normalized = path.posix.normalize(key).replace(/^\/+/, "");
  if (
    normalized !== key.replace(/^\/+/, "") ||
    normalized.startsWith("..") ||
    (!normalized.startsWith("exams/") && !normalized.startsWith("documents/"))
  ) {
    throw new Error("Storage key không hợp lệ.");
  }
  return normalized;
}

function safeLocalPath(key: string) {
  const normalized = safeStorageKey(key);
  return path.join(LOCAL_STORAGE_ROOT, ...normalized.split("/"));
}

export function buildLearningDocumentKey(params: {
  documentId: string;
  version: number;
  filename: string;
}) {
  const extension = path.extname(params.filename).toLowerCase().replace(/[^.a-z0-9]/g, "");
  return `documents/${params.documentId}/v${params.version}/file${extension || ".bin"}`;
}

export function buildLearningAnswerKey(params: {
  documentId: string;
  filename: string;
}) {
  const extension = path.extname(params.filename).toLowerCase().replace(/[^.a-z0-9]/g, "");
  return `documents/${params.documentId}/answer/file${extension || ".pdf"}`;
}

export function buildExamDocumentKey(params: {
  examId: string;
  filename: "de.pdf" | "dapan.pdf";
}) {
  return `exams/${params.examId}/${params.filename}`;
}

export function buildExamRevisionKey(params: {
  examId: string;
  kind: "de" | "dapan";
  revisionId: string;
}) {
  const revisionId = params.revisionId.replace(/[^a-zA-Z0-9-]/g, "");
  if (!revisionId) throw new Error("Mã phiên bản file không hợp lệ.");
  return `exams/${params.examId}/${params.kind}-${revisionId}.pdf`;
}

export async function uploadDocument(
  key: string,
  file: Buffer,
  contentType = "application/pdf",
) {
  const safeKey = safeStorageKey(key);
  if (!isR2Configured()) {
    const destination = safeLocalPath(safeKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file);
    return safeKey;
  }
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: safeKey,
      Body: file,
      ContentType: contentType,
    }),
  );
  return safeKey;
}

export async function readDocument(key: string): Promise<Uint8Array> {
  const safeKey = safeStorageKey(key);
  if (!isR2Configured()) return readFile(safeLocalPath(safeKey));
  const result = await getR2Client().send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: safeKey }),
  );
  if (!result.Body) throw new Error("File không tồn tại.");
  return result.Body.transformToByteArray();
}

export async function getSignedDocumentUrl(
  key: string,
  expiresInSeconds = 300,
  contentDisposition?: string,
) {
  if (!isR2Configured()) throw new Error("Signed URL chỉ dùng khi đã bật R2.");
  const safeKey = safeStorageKey(key);
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: safeKey,
      ResponseContentDisposition: contentDisposition,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300,
) {
  if (!isR2Configured()) throw new Error("Signed upload chỉ dùng khi đã bật R2.");
  const safeKey = safeStorageKey(key);
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: safeKey,
      ContentType: contentType,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export async function getDocumentMetadata(key: string) {
  const safeKey = safeStorageKey(key);
  if (!isR2Configured()) {
    const file = await readFile(safeLocalPath(safeKey));
    return { size: file.byteLength, contentType: undefined as string | undefined };
  }
  const result = await getR2Client().send(
    new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: safeKey }),
  );
  return { size: result.ContentLength ?? 0, contentType: result.ContentType };
}

export async function readDocumentPrefix(key: string, byteCount: number) {
  const safeKey = safeStorageKey(key);
  if (!Number.isInteger(byteCount) || byteCount <= 0 || byteCount > 1024) {
    throw new Error("Độ dài kiểm tra file không hợp lệ.");
  }
  if (!isR2Configured()) {
    const file = await readFile(safeLocalPath(safeKey));
    return file.subarray(0, byteCount);
  }
  const result = await getR2Client().send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: safeKey,
      Range: `bytes=0-${byteCount - 1}`,
    }),
  );
  if (!result.Body) throw new Error("File không tồn tại.");
  return result.Body.transformToByteArray();
}

export async function deleteDocument(key: string) {
  const safeKey = safeStorageKey(key);
  if (!isR2Configured()) {
    await rm(safeLocalPath(safeKey), { force: true });
    return;
  }
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: safeKey }),
  );
}
