import "server-only";

import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { Storage } from "@google-cloud/storage";

const LOCAL_STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");

export function isCloudStorageConfigured() {
  return Boolean(process.env.GCS_BUCKET_NAME?.trim());
}

let storageClient: Storage | null = null;

function getBucket() {
  const bucketName = process.env.GCS_BUCKET_NAME?.trim();
  if (!bucketName) throw new Error("Google Cloud Storage chưa được cấu hình.");
  storageClient ??= new Storage();
  return storageClient.bucket(bucketName);
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
  if (!isCloudStorageConfigured()) {
    const destination = safeLocalPath(safeKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file);
    return safeKey;
  }
  await getBucket().file(safeKey).save(file, {
    resumable: false,
    validation: "crc32c",
    contentType,
    metadata: { cacheControl: "private, max-age=0" },
  });
  return safeKey;
}

export async function readDocument(key: string): Promise<Uint8Array> {
  const safeKey = safeStorageKey(key);
  if (!isCloudStorageConfigured()) return readFile(safeLocalPath(safeKey));
  const [file] = await getBucket().file(safeKey).download();
  return file;
}

export async function getSignedDocumentUrl(
  key: string,
  expiresInSeconds = 300,
  contentDisposition?: string,
) {
  if (!isCloudStorageConfigured()) {
    throw new Error("Signed URL chỉ dùng khi đã bật Google Cloud Storage.");
  }
  const safeKey = safeStorageKey(key);
  const [url] = await getBucket().file(safeKey).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresInSeconds * 1000,
    responseDisposition: contentDisposition,
  });
  return url;
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300,
) {
  if (!isCloudStorageConfigured()) {
    throw new Error("Signed upload chỉ dùng khi đã bật Google Cloud Storage.");
  }
  const safeKey = safeStorageKey(key);
  const [url] = await getBucket().file(safeKey).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + expiresInSeconds * 1000,
    contentType,
  });
  return url;
}

export async function getDocumentMetadata(key: string) {
  const safeKey = safeStorageKey(key);
  if (!isCloudStorageConfigured()) {
    const file = await readFile(safeLocalPath(safeKey));
    return { size: file.byteLength, contentType: undefined as string | undefined };
  }
  const [metadata] = await getBucket().file(safeKey).getMetadata();
  return {
    size: Number(metadata.size ?? 0),
    contentType: metadata.contentType,
  };
}

export async function readDocumentPrefix(key: string, byteCount: number) {
  const safeKey = safeStorageKey(key);
  if (!Number.isInteger(byteCount) || byteCount <= 0 || byteCount > 1024) {
    throw new Error("Độ dài kiểm tra file không hợp lệ.");
  }
  if (!isCloudStorageConfigured()) {
    const file = await readFile(safeLocalPath(safeKey));
    return file.subarray(0, byteCount);
  }
  const [file] = await getBucket().file(safeKey).download({
    start: 0,
    end: byteCount - 1,
    validation: false,
  });
  return file;
}

export async function deleteDocument(key: string) {
  const safeKey = safeStorageKey(key);
  if (!isCloudStorageConfigured()) {
    await rm(safeLocalPath(safeKey), { force: true });
    return;
  }
  await getBucket().file(safeKey).delete({ ignoreNotFound: true });
}
