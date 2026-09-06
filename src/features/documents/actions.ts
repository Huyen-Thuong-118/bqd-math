"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireActiveAdminId } from "@/features/exams/admin";
import { db } from "@/lib/db";
import {
  buildLearningAnswerKey,
  buildLearningDocumentKey,
  deleteDocument as deleteStoredFile,
  getDocumentMetadata,
  getSignedUploadUrl,
  isCloudStorageConfigured,
  uploadDocument,
} from "@/lib/storage";

const MAX_FILE_BYTES = 30 * 1024 * 1024;
type Result = { success: true } | { success: false; error: string };
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

function refresh(documentId?: string) {
  revalidatePath("/admin/tai-lieu");
  revalidatePath("/tai-lieu");
  revalidatePath("/lop-hoc");
  if (documentId) revalidatePath(`/api/documents/${documentId}/file`);
}

function validFile(file: FormDataEntryValue | null, required = true) {
  if (!(file instanceof File) || file.size === 0) return required ? "Hãy chọn file." : null;
  if (file.size > MAX_FILE_BYTES) return "File không được vượt quá 30 MB.";
  const blocked = ["text/html", "application/javascript", "image/svg+xml"];
  if (blocked.includes(file.type)) return "Định dạng file không được hỗ trợ.";
  return null;
}

async function activeClassIds(rawIds: string[]) {
  const ids = [...new Set(rawIds.filter(Boolean))];
  const count = await db.class.count({ where: { id: { in: ids }, status: "ACTIVE" } });
  return count === ids.length ? ids : null;
}

async function validStoredUpload(key: string, expectedContentType?: string) {
  const metadata = await getDocumentMetadata(key);
  if (metadata.size <= 0 || metadata.size > MAX_FILE_BYTES) return false;
  return !(
    expectedContentType &&
    metadata.contentType &&
    metadata.contentType !== expectedContentType
  );
}

export async function prepareDocumentUpload(
  documentId: string,
  version: number,
  fileName: string,
  contentType: string,
  kind: "file" | "answer",
  fileSize: number,
): Promise<UploadTargetResult> {
  try {
    await requireActiveAdminId();
    if (!isCloudStorageConfigured()) return { success: false, error: "Direct upload chỉ bật khi đã cấu hình Google Cloud Storage." };
    if (!/^[a-z0-9-]{10,100}$/i.test(documentId) || !Number.isInteger(version) || version < 1 || fileName.length > 180 || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_BYTES) {
      return { success: false, error: "Thông tin upload không hợp lệ." };
    }
    const key = kind === "answer"
      ? buildLearningAnswerKey({ documentId, filename: fileName })
      : buildLearningDocumentKey({ documentId, version, filename: fileName });
    const uploadUrl = await getSignedUploadUrl(key, contentType || "application/octet-stream");
    return { success: true, key, uploadUrl };
  } catch (error) {
    console.error("prepareDocumentUpload thất bại:", error);
    return { success: false, error: "Không thể tạo đường dẫn upload." };
  }
}

export async function createDocument(formData: FormData): Promise<Result> {
  let uploadedFileKey: string | undefined;
  let uploadedAnswerKey: string | undefined;
  try {
    await requireActiveAdminId();
    const title = text(formData, "title");
    const folderId = text(formData, "folderId") || null;
    const documentId = text(formData, "documentId") || randomUUID();
    const classIds = await activeClassIds(formData.getAll("classIds").filter((item): item is string => typeof item === "string"));
    if (title.length < 2 || title.length > 180) return { success: false, error: "Tên tài liệu phải có từ 2 đến 180 ký tự." };
    if (!classIds || classIds.length === 0) return { success: false, error: "Hãy chọn ít nhất một lớp đang hoạt động." };
    if (folderId && !(await db.folder.findUnique({ where: { id: folderId }, select: { id: true } }))) return { success: false, error: "Thư mục không tồn tại." };

    const directKey = text(formData, "fileKey");
    const directAnswerKey = text(formData, "answerKey");
    const file = formData.get("file");
    const answer = formData.get("answer");
    let fileName = text(formData, "fileName");
    let contentType = text(formData, "contentType") || "application/octet-stream";
    if (directKey) {
      if (!directKey.startsWith(`documents/${documentId}/v1/`)) return { success: false, error: "Storage key không hợp lệ." };
      if (!(await validStoredUpload(directKey, contentType))) return { success: false, error: "File upload không tồn tại hoặc không hợp lệ." };
      uploadedFileKey = directKey;
    } else {
      const error = validFile(file);
      if (error || !(file instanceof File)) return { success: false, error: error ?? "File không hợp lệ." };
      fileName = file.name;
      contentType = file.type || "application/octet-stream";
      uploadedFileKey = buildLearningDocumentKey({ documentId, version: 1, filename: file.name });
      await uploadDocument(uploadedFileKey, Buffer.from(await file.arrayBuffer()), contentType);
    }
    if (directAnswerKey) {
      if (!directAnswerKey.startsWith(`documents/${documentId}/answer/`)) return { success: false, error: "Storage key đáp án không hợp lệ." };
      if (!(await validStoredUpload(directAnswerKey))) return { success: false, error: "File đáp án upload không tồn tại hoặc không hợp lệ." };
      uploadedAnswerKey = directAnswerKey;
    } else if (answer instanceof File && answer.size > 0) {
      const error = validFile(answer, false);
      if (error) return { success: false, error };
      uploadedAnswerKey = buildLearningAnswerKey({ documentId, filename: answer.name });
      await uploadDocument(uploadedAnswerKey, Buffer.from(await answer.arrayBuffer()), answer.type || "application/pdf");
    }

    await db.document.create({
      data: {
        id: documentId, title, fileUrl: uploadedFileKey, fileName, contentType,
        answerUrl: uploadedAnswerKey,
        showAnswer: Boolean(uploadedAnswerKey) && checked(formData, "showAnswer"),
        allowDownload: checked(formData, "allowDownload"), folderId,
        classLinks: { create: classIds.map((classId) => ({ classId })) },
        versions: { create: { version: 1, fileUrl: uploadedFileKey, fileName, contentType } },
      },
    });
    refresh(documentId);
    return { success: true };
  } catch (error) {
    console.error("createDocument thất bại:", error);
    if (uploadedFileKey) await deleteStoredFile(uploadedFileKey).catch(() => undefined);
    if (uploadedAnswerKey) await deleteStoredFile(uploadedAnswerKey).catch(() => undefined);
    return { success: false, error: "Không thể tạo tài liệu." };
  }
}

export async function updateDocumentMetadata(documentId: string, formData: FormData): Promise<Result> {
  try {
    await requireActiveAdminId();
    const title = text(formData, "title");
    const folderId = text(formData, "folderId") || null;
    const classIds = await activeClassIds(formData.getAll("classIds").filter((item): item is string => typeof item === "string"));
    if (title.length < 2 || title.length > 180) return { success: false, error: "Tên tài liệu không hợp lệ." };
    if (!classIds || classIds.length === 0) return { success: false, error: "Hãy chọn ít nhất một lớp đang hoạt động." };
    if (folderId && !(await db.folder.findUnique({ where: { id: folderId }, select: { id: true } }))) return { success: false, error: "Thư mục không tồn tại." };
    await db.$transaction([
      db.document.update({ where: { id: documentId }, data: { title, folderId, allowDownload: checked(formData, "allowDownload"), showAnswer: checked(formData, "showAnswer") } }),
      db.documentClass.deleteMany({ where: { documentId, classId: { notIn: classIds } } }),
      db.documentClass.createMany({ data: classIds.map((classId) => ({ documentId, classId })), skipDuplicates: true }),
    ]);
    refresh(documentId);
    return { success: true };
  } catch (error) {
    console.error("updateDocumentMetadata thất bại:", error);
    return { success: false, error: "Không thể cập nhật tài liệu." };
  }
}

export async function replaceDocumentFile(documentId: string, formData: FormData): Promise<Result> {
  let key: string | undefined;
  try {
    await requireActiveAdminId();
    const document = await db.document.findUnique({ where: { id: documentId }, select: { updateCount: true } });
    if (!document) return { success: false, error: "Không tìm thấy tài liệu." };
    const version = document.updateCount + 2;
    const directKey = text(formData, "fileKey");
    const file = formData.get("file");
    let fileName = text(formData, "fileName");
    let contentType = text(formData, "contentType") || "application/octet-stream";
    if (directKey) {
      if (!directKey.startsWith(`documents/${documentId}/v${version}/`)) return { success: false, error: "Storage key không hợp lệ." };
      if (!(await validStoredUpload(directKey, contentType))) return { success: false, error: "File upload không tồn tại hoặc không hợp lệ." };
      key = directKey;
    } else {
      const error = validFile(file);
      if (error || !(file instanceof File)) return { success: false, error: error ?? "File không hợp lệ." };
      fileName = file.name;
      contentType = file.type || "application/octet-stream";
      key = buildLearningDocumentKey({ documentId, version, filename: fileName });
      await uploadDocument(key, Buffer.from(await file.arrayBuffer()), contentType);
    }
    await db.$transaction([
      db.document.update({ where: { id: documentId }, data: { fileUrl: key, fileName, contentType, updateCount: { increment: 1 } } }),
      db.documentVersion.create({ data: { documentId, version, fileUrl: key, fileName, contentType } }),
    ]);
    refresh(documentId);
    return { success: true };
  } catch (error) {
    console.error("replaceDocumentFile thất bại:", error);
    if (key) await deleteStoredFile(key).catch(() => undefined);
    return { success: false, error: "Không thể cập nhật phiên bản file." };
  }
}

export async function createFolder(formData: FormData): Promise<Result> {
  try {
    await requireActiveAdminId();
    const name = text(formData, "name");
    const parentId = text(formData, "parentId") || null;
    if (name.length < 1 || name.length > 100) return { success: false, error: "Tên thư mục không hợp lệ." };
    if (parentId && !(await db.folder.findUnique({ where: { id: parentId }, select: { id: true } }))) return { success: false, error: "Thư mục cha không tồn tại." };
    await db.folder.create({ data: { name, parentId } });
    refresh();
    return { success: true };
  } catch (error) {
    console.error("createFolder thất bại:", error);
    return { success: false, error: "Không thể tạo thư mục." };
  }
}

export async function deleteFolder(folderId: string): Promise<Result> {
  try {
    await requireActiveAdminId();
    const folder = await db.folder.findUnique({ where: { id: folderId }, select: { _count: { select: { children: true, documents: true } } } });
    if (!folder) return { success: false, error: "Không tìm thấy thư mục." };
    if (folder._count.children || folder._count.documents) return { success: false, error: "Chỉ có thể xóa thư mục rỗng." };
    await db.folder.delete({ where: { id: folderId } });
    refresh();
    return { success: true };
  } catch (error) {
    console.error("deleteFolder thất bại:", error);
    return { success: false, error: "Không thể xóa thư mục." };
  }
}
