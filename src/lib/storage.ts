import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Client cho Cloudflare R2 — dùng API S3-compatible (không cần SDK riêng).
 * R2 KHÔNG tính phí egress, phù hợp lưu PDF đề thi/tài liệu được xem đi
 * xem lại nhiều lần bởi hàng trăm học sinh. Xem ARCHITECTURE.md mục
 * "Lưu trữ tài liệu" để biết lý do chọn R2 thay vì S3.
 */
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

/**
 * Quy ước đặt key (đường dẫn file trong bucket) — xem ARCHITECTURE.md.
 * Ví dụ: documents/{classId}/{examId}/de.pdf
 */
export function buildDocumentKey(params: {
  classId: string;
  examId: string;
  filename: "de.pdf" | "dapan.pdf";
}) {
  return `documents/${params.classId}/${params.examId}/${params.filename}`;
}

/** Upload 1 file (dùng trong Server Action khi admin tạo đề mới). */
export async function uploadDocument(key: string, file: Buffer, contentType = "application/pdf") {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Tạo signed URL có thời hạn ngắn để HS xem file — KHÔNG trả link public
 * vĩnh viễn, tránh bị chia sẻ link ra ngoài lớp.
 * expiresInSeconds mặc định 5 phút, đủ để load PDF trong PdfViewer.
 */
export async function getSignedDocumentUrl(key: string, expiresInSeconds = 300) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

export async function deleteDocument(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
