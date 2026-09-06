import "server-only";

import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";

import { requireActiveStudentId } from "@/features/exams/access";
import { db } from "@/lib/db";

import {
  DOCUMENT_PAGE_SIZE,
  type StudentDocumentFilters,
} from "./filters";

function descendantFolderIds(
  folderId: string,
  folders: { id: string; parentId: string | null }[],
) {
  const result = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentId && result.has(folder.parentId) && !result.has(folder.id)) {
        result.add(folder.id);
        changed = true;
      }
    }
  }
  return [...result];
}

function visibleFolderOptions(
  folders: { id: string; name: string; parentId: string | null }[],
  directFolderIds: string[],
) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const visibleIds = new Set<string>();
  for (const folderId of directFolderIds) {
    let currentId: string | null = folderId;
    const seen = new Set<string>();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      visibleIds.add(currentId);
      currentId = byId.get(currentId)?.parentId ?? null;
    }
  }
  return folders
    .filter((folder) => visibleIds.has(folder.id))
    .map((folder) => {
      const names = [folder.name];
      let currentId = folder.parentId;
      const seen = new Set<string>();
      while (currentId && !seen.has(currentId)) {
        seen.add(currentId);
        const parent = byId.get(currentId);
        if (!parent) break;
        names.unshift(parent.name);
        currentId = parent.parentId;
      }
      return { id: folder.id, label: names.join(" / ") };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

export async function getDocumentsForCurrentStudent(filters: StudentDocumentFilters) {
  const studentId = await requireActiveStudentId();
  const accessWhere = {
    classLinks: { some: { class: { enrollments: { some: { studentId } } } } },
  } satisfies Prisma.DocumentWhereInput;
  const folders = await db.folder.findMany({
    select: { id: true, name: true, parentId: true },
  });
  const folderIds = filters.folderId
    ? filters.includeChildren
      ? descendantFolderIds(filters.folderId, folders)
      : [filters.folderId]
    : [];
  const typeWhere: Record<NonNullable<StudentDocumentFilters["type"]>, Prisma.DocumentWhereInput> = {
    PDF: {
      OR: [
        { contentType: "application/pdf" },
        { fileName: { endsWith: ".pdf", mode: "insensitive" } },
      ],
    },
    IMAGE: { contentType: { startsWith: "image/" } },
    VIDEO: { contentType: { startsWith: "video/" } },
    OTHER: {
      NOT: {
        OR: [
          { contentType: "application/pdf" },
          { fileName: { endsWith: ".pdf", mode: "insensitive" } },
          { contentType: { startsWith: "image/" } },
          { contentType: { startsWith: "video/" } },
        ],
      },
    },
  };
  const where = {
    AND: [
      accessWhere,
      ...(filters.q ? [{ OR: [
        { title: { contains: filters.q, mode: "insensitive" as const } },
        { fileName: { contains: filters.q, mode: "insensitive" as const } },
      ] }] : []),
      ...(folderIds.length ? [{ folderId: { in: folderIds } }] : []),
      ...(filters.classId ? [{
        classLinks: { some: {
          classId: filters.classId,
          class: { enrollments: { some: { studentId } } },
        } },
      }] : []),
      ...(filters.type ? [typeWhere[filters.type]] : []),
      ...(filters.publishedAnswer ? [{ answerUrl: { not: null }, showAnswer: true }] : []),
      ...(filters.downloadable ? [{ allowDownload: true }] : []),
    ],
  } satisfies Prisma.DocumentWhereInput;
  const orderBy: Prisma.DocumentOrderByWithRelationInput =
    filters.sort === "OLDEST" ? { createdAt: "asc" }
      : filters.sort === "TITLE" ? { title: "asc" }
        : filters.sort === "UPDATED" ? { updatedAt: "desc" }
          : { createdAt: "desc" };

  const [documents, total, hasAnyDocuments, classes, directFolders] = await Promise.all([
    db.document.findMany({
      where,
      select: {
        id: true,
        title: true,
        fileName: true,
        contentType: true,
        allowDownload: true,
        answerUrl: true,
        showAnswer: true,
        updateCount: true,
        createdAt: true,
        folder: {
          select: {
            id: true,
            name: true,
            parent: {
              select: {
                id: true,
                name: true,
                parent: { select: { id: true, name: true } },
              },
            },
          },
        },
        classLinks: {
          where: { class: { enrollments: { some: { studentId } } } },
          select: { class: { select: { name: true } } },
        },
      },
      orderBy,
      skip: (filters.page - 1) * DOCUMENT_PAGE_SIZE,
      take: DOCUMENT_PAGE_SIZE,
    }),
    db.document.count({ where }),
    db.document.count({ where: accessWhere }),
    db.class.findMany({
      where: {
        enrollments: { some: { studentId } },
        documentLinks: { some: {} },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.document.findMany({
      where: { ...accessWhere, folderId: { not: null } },
      distinct: ["folderId"],
      select: { folderId: true },
    }),
  ]);

  return {
    documents,
    filterOptions: {
      classes,
      folders: visibleFolderOptions(
        folders,
        directFolders.flatMap((item) => item.folderId ? [item.folderId] : []),
      ),
    },
    hasAnyDocuments: hasAnyDocuments > 0,
    pagination: {
      page: filters.page,
      pageSize: DOCUMENT_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / DOCUMENT_PAGE_SIZE)),
    },
  };
}

export async function getDocumentForCurrentStudent(documentId: string) {
  const studentId = await requireActiveStudentId();
  const document = await db.document.findFirst({
    where: {
      id: documentId,
      classLinks: { some: { class: { enrollments: { some: { studentId } } } } },
    },
    select: {
      id: true,
      title: true,
      fileName: true,
      contentType: true,
      allowDownload: true,
      answerUrl: true,
      showAnswer: true,
      updateCount: true,
    },
  });
  if (!document) notFound();
  const user = await db.user.findFirst({
    where: { id: studentId },
    select: { name: true },
  });
  return { ...document, studentName: user?.name ?? "Học sinh" };
}
