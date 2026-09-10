"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireActiveAdminId } from "./admin";

type Result = { success: true } | { success: false; error: string };

async function nextExamFolderCopyName(name: string, parentId: string | null) {
  const siblings = await db.folder.findMany({ where: { kind: "EXAM", parentId }, select: { name: true } });
  const names = new Set(siblings.map((item) => item.name.toLocaleLowerCase("vi")));
  let candidate = `${name} (bản sao)`;
  let index = 2;
  while (names.has(candidate.toLocaleLowerCase("vi"))) candidate = `${name} (bản sao ${index++})`;
  return candidate;
}

async function cloneExam(tx: Prisma.TransactionClient, examId: string, folderId: string | null, rename: boolean) {
  const source = await tx.exam.findUnique({
    where: { id: examId },
    include: { questions: { orderBy: { number: "asc" } }, examLinks: true },
  });
  if (!source) throw new Error("Không tìm thấy đề thi.");
  const last = await tx.exam.aggregate({ where: { folderId }, _max: { position: true } });
  await tx.exam.create({ data: {
    title: rename ? `${source.title} (bản sao)` : source.title,
    mode: source.mode, status: source.status, publishedAt: source.publishedAt, source: source.source,
    classId: source.classId, examFileUrl: source.examFileUrl, answerFileUrl: source.answerFileUrl,
    showAnswer: source.showAnswer, folderId, position: (last._max.position ?? -1) + 1,
    isForever: source.isForever, availableFrom: source.availableFrom, availableTo: source.availableTo,
    durationMinutes: source.durationMinutes, maxAttempts: source.maxAttempts,
    allowDownload: source.allowDownload, hideWrongAnswers: source.hideWrongAnswers,
    ...(source.scoringPolicy === null ? {} : { scoringPolicy: source.scoringPolicy as Prisma.InputJsonValue }),
    ...(source.answerSheetConfig === null ? {} : { answerSheetConfig: source.answerSheetConfig as Prisma.InputJsonValue }),
    examLinks: { create: source.examLinks.map((link) => ({ classId: link.classId })) },
    questions: { create: source.questions.map((question) => ({
      number: question.number, type: question.type, content: question.content,
      options: question.options as Prisma.InputJsonValue, correctAnswer: question.correctAnswer,
      points: question.points, explanation: question.explanation,
    })) },
  } });
}

function refresh(examId?: string) {
  revalidatePath("/admin/de-thi");
  revalidatePath("/admin/de-thi/tao-moi");
  if (examId) revalidatePath(`/admin/de-thi/${examId}/chinh-sua`);
}

async function normalizeFolders(tx: Prisma.TransactionClient, parentId: string | null) {
  const folders = await tx.folder.findMany({
    where: { kind: "EXAM", parentId },
    select: { id: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  await Promise.all(folders.map((folder, position) => tx.folder.update({ where: { id: folder.id }, data: { position } })));
}

async function normalizeExams(tx: Prisma.TransactionClient, folderId: string | null) {
  const exams = await tx.exam.findMany({
    where: { folderId },
    select: { id: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  await Promise.all(exams.map((exam, position) => tx.exam.update({ where: { id: exam.id }, data: { position } })));
}

function positionIn(length: number, requested?: number) {
  return Number.isInteger(requested) ? Math.max(0, Math.min(requested as number, length)) : length;
}

async function duplicateName(name: string, parentId: string | null, excludeId?: string) {
  return db.folder.findFirst({
    where: { kind: "EXAM", parentId, name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
}

export async function createExamFolder(formData: FormData): Promise<Result> {
  try {
    await requireActiveAdminId();
    const rawName = formData.get("name");
    const rawParentId = formData.get("parentId");
    const name = typeof rawName === "string" ? rawName.trim() : "";
    const parentId = typeof rawParentId === "string" && rawParentId ? rawParentId : null;
    if (!name || name.length > 100) return { success: false, error: "Tên thư mục không hợp lệ." };
    if (parentId && !(await db.folder.findFirst({ where: { id: parentId, kind: "EXAM" }, select: { id: true } }))) {
      return { success: false, error: "Thư mục cha không tồn tại." };
    }
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
    if (await duplicateName(name, parentId)) return { success: false, error: "Đã có thư mục cùng tên ở cấp này." };
    const last = await db.folder.aggregate({ where: { kind: "EXAM", parentId }, _max: { position: true } });
    await db.folder.create({ data: { name, kind: "EXAM", parentId, position: (last._max.position ?? -1) + 1 } });
    refresh();
    return { success: true };
  } catch (error) {
    console.error("createExamFolder thất bại:", error);
    return { success: false, error: "Không thể tạo thư mục đề thi." };
  }
}

export async function renameExamFolder(folderId: string, name: string): Promise<Result> {
  try {
    await requireActiveAdminId();
    const nextName = name.trim();
    if (!nextName || nextName.length > 100) return { success: false, error: "Tên thư mục không hợp lệ." };
    const folder = await db.folder.findFirst({ where: { id: folderId, kind: "EXAM" }, select: { parentId: true } });
    if (!folder) return { success: false, error: "Không tìm thấy thư mục." };
    if (await duplicateName(nextName, folder.parentId, folderId)) return { success: false, error: "Đã có thư mục cùng tên ở cấp này." };
    const result = await db.folder.updateMany({ where: { id: folderId, kind: "EXAM" }, data: { name: nextName } });
    if (!result.count) return { success: false, error: "Không tìm thấy thư mục." };
    refresh();
    return { success: true };
  } catch (error) {
    console.error("renameExamFolder thất bại:", error);
    return { success: false, error: "Không thể đổi tên thư mục." };
  }
}

export async function deleteExamFolder(folderId: string): Promise<Result> {
  try {
    await requireActiveAdminId();
    const folder = await db.folder.findFirst({
      where: { id: folderId, kind: "EXAM" },
      select: { parentId: true, _count: { select: { children: true, documents: true, exams: true } } },
    });
    if (!folder) return { success: false, error: "Không tìm thấy thư mục." };
    if (folder._count.children || folder._count.documents || folder._count.exams) return { success: false, error: "Chỉ có thể xóa thư mục rỗng." };
    await db.$transaction(async (tx) => {
      await tx.folder.delete({ where: { id: folderId } });
      await normalizeFolders(tx, folder.parentId);
    });
    refresh();
    return { success: true };
  } catch (error) {
    console.error("deleteExamFolder thất bại:", error);
    return { success: false, error: "Không thể xóa thư mục." };
  }
}

export async function moveExamFolder(folderId: string, parentId: string | null, position?: number): Promise<Result> {
  try {
    await requireActiveAdminId();
    if (folderId === parentId) return { success: false, error: "Không thể chuyển thư mục vào chính nó." };
    const folder = await db.folder.findFirst({ where: { id: folderId, kind: "EXAM" }, select: { name: true, parentId: true } });
    if (!folder) return { success: false, error: "Không tìm thấy thư mục." };

    const tree = await db.folder.findMany({ where: { kind: "EXAM" }, select: { id: true, parentId: true } });
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
    if (await duplicateName(folder.name, parentId, folderId)) return { success: false, error: "Thư mục đích đã có thư mục cùng tên." };

    await db.$transaction(async (tx) => {
      const siblings = await tx.folder.findMany({
        where: { kind: "EXAM", parentId, id: { not: folderId } },
        select: { id: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      });
      siblings.splice(positionIn(siblings.length, position), 0, { id: folderId });
      await tx.folder.update({ where: { id: folderId }, data: { parentId } });
      await Promise.all(siblings.map((item, index) => tx.folder.update({ where: { id: item.id }, data: { position: index } })));
      if (folder.parentId !== parentId) await normalizeFolders(tx, folder.parentId);
    });
    refresh();
    return { success: true };
  } catch (error) {
    console.error("moveExamFolder thất bại:", error);
    return { success: false, error: "Không thể di chuyển thư mục." };
  }
}

export async function moveExam(examId: string, folderId: string | null, position?: number): Promise<Result> {
  try {
    await requireActiveAdminId();
    if (folderId && !(await db.folder.findFirst({ where: { id: folderId, kind: "EXAM" }, select: { id: true } }))) {
      return { success: false, error: "Thư mục đích không tồn tại." };
    }
    const exam = await db.exam.findUnique({ where: { id: examId }, select: { folderId: true } });
    if (!exam) return { success: false, error: "Không tìm thấy đề thi." };
    await db.$transaction(async (tx) => {
      const siblings = await tx.exam.findMany({
        where: { folderId, id: { not: examId } },
        select: { id: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      });
      siblings.splice(positionIn(siblings.length, position), 0, { id: examId });
      await tx.exam.update({ where: { id: examId }, data: { folderId } });
      await Promise.all(siblings.map((item, index) => tx.exam.update({ where: { id: item.id }, data: { position: index } })));
      if (exam.folderId !== folderId) await normalizeExams(tx, exam.folderId);
    });
    refresh(examId);
    return { success: true };
  } catch (error) {
    console.error("moveExam thất bại:", error);
    return { success: false, error: "Không thể di chuyển đề thi." };
  }
}

export async function copyExam(examId: string, folderId: string | null): Promise<Result> {
  try {
    await requireActiveAdminId();
    if (folderId && !(await db.folder.findFirst({ where: { id: folderId, kind: "EXAM" }, select: { id: true } }))) {
      return { success: false, error: "Thư mục đích không tồn tại." };
    }
    await db.$transaction((tx) => cloneExam(tx, examId, folderId, true));
    refresh();
    return { success: true };
  } catch (error) {
    console.error("copyExam thất bại:", error);
    return { success: false, error: "Không thể sao chép đề thi." };
  }
}

export async function copyExamFolder(folderId: string, parentId: string | null): Promise<Result> {
  try {
    await requireActiveAdminId();
    if (folderId === parentId) return { success: false, error: "Không thể sao chép thư mục vào chính nó." };
    const sourceRoot = await db.folder.findFirst({ where: { id: folderId, kind: "EXAM" }, select: { name: true } });
    if (!sourceRoot) return { success: false, error: "Không tìm thấy thư mục." };
    if (parentId && !(await db.folder.findFirst({ where: { id: parentId, kind: "EXAM" }, select: { id: true } }))) {
      return { success: false, error: "Thư mục đích không tồn tại." };
    }
    let cursor = parentId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      if (cursor === folderId) return { success: false, error: "Không thể sao chép thư mục vào thư mục con của nó." };
      seen.add(cursor);
      cursor = (await db.folder.findUnique({ where: { id: cursor }, select: { parentId: true } }))?.parentId ?? null;
    }
    const rootName = await nextExamFolderCopyName(sourceRoot.name, parentId);
    await db.$transaction(async (tx) => {
      async function cloneFolder(sourceId: string, targetParentId: string | null, name?: string): Promise<void> {
        const source = await tx.folder.findFirst({ where: { id: sourceId, kind: "EXAM" }, select: { name: true } });
        if (!source) throw new Error("Không tìm thấy thư mục nguồn.");
        const last = await tx.folder.aggregate({ where: { kind: "EXAM", parentId: targetParentId }, _max: { position: true } });
        const target = await tx.folder.create({ data: { name: name ?? source.name, kind: "EXAM", parentId: targetParentId, position: (last._max.position ?? -1) + 1 } });
        const exams = await tx.exam.findMany({ where: { folderId: sourceId }, select: { id: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
        for (const exam of exams) await cloneExam(tx, exam.id, target.id, false);
        const children = await tx.folder.findMany({ where: { kind: "EXAM", parentId: sourceId }, select: { id: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
        for (const child of children) await cloneFolder(child.id, target.id);
      }
      await cloneFolder(folderId, parentId, rootName);
    });
    refresh();
    return { success: true };
  } catch (error) {
    console.error("copyExamFolder thất bại:", error);
    return { success: false, error: "Không thể sao chép thư mục đề thi." };
  }
}
