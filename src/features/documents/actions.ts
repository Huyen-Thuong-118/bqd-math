"use server";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
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

async function documentFolderExists(folderId: string) {
  return db.folder.findFirst({
    where: { id: folderId, kind: "DOCUMENT" },
    select: { id: true },
  });
}

async function duplicateDocumentFolderName(name: string, parentId: string | null, excludeId?: string) {
  return db.folder.findFirst({
    where: {
      kind: "DOCUMENT",
      parentId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
}

async function normalizeFolders(
  tx: Prisma.TransactionClient,
  parentId: string | null,
) {
  const siblings = await tx.folder.findMany({
    where: { kind: "DOCUMENT", parentId },
    select: { id: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  await Promise.all(
    siblings.map((folder, position) =>
      tx.folder.update({ where: { id: folder.id }, data: { position } }),
    ),
  );
}

async function normalizeDocuments(
  tx: Prisma.TransactionClient,
  folderId: string | null,
) {
  const documents = await tx.document.findMany({
    where: { folderId },
    select: { id: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  await Promise.all(
    documents.map((document, position) =>
      tx.document.update({ where: { id: document.id }, data: { position } }),
    ),
  );
}

function insertAt<T>(items: T[], item: T, requestedPosition?: number) {
  const position = Number.isInteger(requestedPosition)
    ? Math.max(0, Math.min(requestedPosition as number, items.length))
    : items.length;
  return [...items.slice(0, position), item, ...items.slice(position)];
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
    if (folderId && !(await documentFolderExists(folderId))) return { success: false, error: "Thư mục tài liệu không tồn tại." };

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

    const lastPosition = await db.document.aggregate({
      where: { folderId },
      _max: { position: true },
    });
    await db.document.create({
      data: {
        id: documentId, title, fileUrl: uploadedFileKey, fileName, contentType,
        answerUrl: uploadedAnswerKey,
        showAnswer: Boolean(uploadedAnswerKey) && checked(formData, "showAnswer"),
        allowDownload: checked(formData, "allowDownload"), folderId,
        position: (lastPosition._max.position ?? -1) + 1,
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
    if (folderId && !(await documentFolderExists(folderId))) return { success: false, error: "Thư mục tài liệu không tồn tại." };
    const current = await db.document.findUnique({ where: { id: documentId }, select: { folderId: true } });
    if (!current) return { success: false, error: "Không tìm thấy tài liệu." };
    await db.$transaction(async (tx) => {
      let position: number | undefined;
      if (current.folderId !== folderId) {
        const last = await tx.document.aggregate({ where: { folderId }, _max: { position: true } });
        position = (last._max.position ?? -1) + 1;
      }
      await tx.document.update({ where: { id: documentId }, data: { title, folderId, position, allowDownload: checked(formData, "allowDownload"), showAnswer: checked(formData, "showAnswer") } });
      await tx.documentClass.deleteMany({ where: { documentId, classId: { notIn: classIds } } });
      await tx.documentClass.createMany({ data: classIds.map((classId) => ({ documentId, classId })), skipDuplicates: true });
      if (current.folderId !== folderId) await normalizeDocuments(tx, current.folderId);
    });
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
    if (parentId && !(await documentFolderExists(parentId))) return { success: false, error: "Thư mục cha không tồn tại." };
    let cursor = parentId;
    let depth = 1;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor)) return { success: false, error: "Cây thư mục hiện không hợp lệ." };
      seen.add(cursor);
      depth += 1;
      if (depth > 8) return { success: false, error: "Cây thư mục chỉ hỗ trợ tối đa 8 cấp." };
      cursor = (await db.folder.findUnique({ where: { id: cursor }, select: { parentId: true } }))?.parentId ?? null;
    }
    if (await duplicateDocumentFolderName(name, parentId)) return { success: false, error: "Đã có thư mục cùng tên ở cấp này." };
    const last = await db.folder.aggregate({ where: { kind: "DOCUMENT", parentId }, _max: { position: true } });
    await db.folder.create({ data: { name, parentId, kind: "DOCUMENT", position: (last._max.position ?? -1) + 1 } });
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
    const folder = await db.folder.findFirst({ where: { id: folderId, kind: "DOCUMENT" }, select: { parentId: true, _count: { select: { children: true, documents: true, exams: true } } } });
    if (!folder) return { success: false, error: "Không tìm thấy thư mục." };
    if (folder._count.children || folder._count.documents || folder._count.exams) return { success: false, error: "Chỉ có thể xóa thư mục rỗng." };
    await db.$transaction(async (tx) => {
      await tx.folder.delete({ where: { id: folderId } });
      await normalizeFolders(tx, folder.parentId);
    });
    refresh();
    return { success: true };
  } catch (error) {
    console.error("deleteFolder thất bại:", error);
    return { success: false, error: "Không thể xóa thư mục." };
  }
}

export async function renameFolder(folderId: string, name: string): Promise<Result> {
  try {
    await requireActiveAdminId();
    const nextName = name.trim();
    if (nextName.length < 1 || nextName.length > 100) return { success: false, error: "Tên thư mục không hợp lệ." };
    const folder = await db.folder.findFirst({ where: { id: folderId, kind: "DOCUMENT" }, select: { parentId: true } });
    if (!folder) return { success: false, error: "Không tìm thấy thư mục." };
    if (await duplicateDocumentFolderName(nextName, folder.parentId, folderId)) return { success: false, error: "Đã có thư mục cùng tên ở cấp này." };
    const updated = await db.folder.updateMany({
      where: { id: folderId, kind: "DOCUMENT" },
      data: { name: nextName },
    });
    if (!updated.count) return { success: false, error: "Không tìm thấy thư mục." };
    refresh();
    return { success: true };
  } catch (error) {
    console.error("renameFolder thất bại:", error);
    return { success: false, error: "Không thể đổi tên thư mục." };
  }
}

export async function moveFolder(
  folderId: string,
  parentId: string | null,
  position?: number,
): Promise<Result> {
  try {
    await requireActiveAdminId();
    if (folderId === parentId) return { success: false, error: "Không thể chuyển thư mục vào chính nó." };
    const folder = await db.folder.findFirst({ where: { id: folderId, kind: "DOCUMENT" }, select: { id: true, name: true, parentId: true } });
    if (!folder) return { success: false, error: "Không tìm thấy thư mục." };

    const tree = await db.folder.findMany({ where: { kind: "DOCUMENT" }, select: { id: true, parentId: true } });
    const byId = new Map(tree.map((item) => [item.id, item]));
    let cursor = parentId;
    const seen = new Set<string>();
    let parentDepth = 0;
    while (cursor) {
      if (cursor === folderId) return { success: false, error: "Không thể chuyển thư mục vào một thư mục con của nó." };
      if (seen.has(cursor)) return { success: false, error: "Cây thư mục hiện không hợp lệ." };
      seen.add(cursor);
      parentDepth += 1;
      const parent = byId.get(cursor);
      if (!parent) return { success: false, error: "Thư mục đích không tồn tại." };
      cursor = parent.parentId;
    }
    const children = new Map<string, string[]>();
    for (const item of tree) {
      if (!item.parentId) continue;
      children.set(item.parentId, [...(children.get(item.parentId) ?? []), item.id]);
    }
    function subtreeHeight(id: string, trail = new Set<string>()): number {
      if (trail.has(id)) return 9;
      const nextTrail = new Set(trail).add(id);
      const heights = (children.get(id) ?? []).map((childId) => subtreeHeight(childId, nextTrail));
      return 1 + (heights.length ? Math.max(...heights) : 0);
    }
    if (parentDepth + subtreeHeight(folderId) > 8) return { success: false, error: "Cây thư mục chỉ hỗ trợ tối đa 8 cấp." };
    if (await duplicateDocumentFolderName(folder.name, parentId, folderId)) return { success: false, error: "Thư mục đích đã có thư mục cùng tên." };

    await db.$transaction(async (tx) => {
      const targetSiblings = await tx.folder.findMany({
        where: { kind: "DOCUMENT", parentId, id: { not: folderId } },
        select: { id: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      });
      const ordered = insertAt(targetSiblings, { id: folderId }, position);
      await tx.folder.update({ where: { id: folderId }, data: { parentId } });
      await Promise.all(ordered.map((item, index) => tx.folder.update({ where: { id: item.id }, data: { position: index } })));
      if (folder.parentId !== parentId) await normalizeFolders(tx, folder.parentId);
    });
    refresh();
    return { success: true };
  } catch (error) {
    console.error("moveFolder thất bại:", error);
    return { success: false, error: "Không thể di chuyển thư mục." };
  }
}

export async function moveDocument(
  documentId: string,
  folderId: string | null,
  position?: number,
): Promise<Result> {
  try {
    await requireActiveAdminId();
    if (folderId && !(await documentFolderExists(folderId))) return { success: false, error: "Thư mục đích không tồn tại." };
    const document = await db.document.findUnique({ where: { id: documentId }, select: { folderId: true } });
    if (!document) return { success: false, error: "Không tìm thấy tài liệu." };

    await db.$transaction(async (tx) => {
      const targetDocuments = await tx.document.findMany({
        where: { folderId, id: { not: documentId } },
        select: { id: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      });
      const ordered = insertAt(targetDocuments, { id: documentId }, position);
      await tx.document.update({ where: { id: documentId }, data: { folderId } });
      await Promise.all(ordered.map((item, index) => tx.document.update({ where: { id: item.id }, data: { position: index } })));
      if (document.folderId !== folderId) await normalizeDocuments(tx, document.folderId);
    });
    refresh(documentId);
    return { success: true };
  } catch (error) {
    console.error("moveDocument thất bại:", error);
    return { success: false, error: "Không thể di chuyển tài liệu." };
  }
}
