import "server-only";

import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { SearchData, SearchFilters, SearchItem } from "./types";

function folderLabels(rows: { id: string; name: string; parentId: string | null }[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return new Map(rows.map((row) => {
    const names = [row.name];
    let parentId = row.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parent.parentId;
    }
    return [row.id, names.join(" / ")] as const;
  }));
}

async function getFolderLabelsForResults(folderIds: (string | null)[]) {
  const rows = new Map<string, { id: string; name: string; parentId: string | null }>();
  let pending = [...new Set(folderIds.filter((id): id is string => Boolean(id)))];
  for (let depth = 0; pending.length && depth < 8; depth += 1) {
    const found = await db.folder.findMany({
      where: { id: { in: pending } },
      select: { id: true, name: true, parentId: true },
    });
    for (const folder of found) rows.set(folder.id, folder);
    pending = [...new Set(found.map((folder) => folder.parentId).filter((id): id is string => Boolean(id) && !rows.has(id!)))];
  }
  return folderLabels([...rows.values()]);
}

export async function getSearchResults(filters: SearchFilters): Promise<SearchData> {
  const session = await auth();
  if (!session?.user.id) redirect("/dang-nhap");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true, status: true } });
  if (!user || user.status !== "ACTIVE") redirect("/sau-dang-nhap");
  const isAdmin = user.role === "ADMIN";
  const q = filters.q.trim().slice(0, 100);
  const pageSize = 20;
  const skip = (filters.page - 1) * pageSize;
  const empty = { items: [] as SearchItem[], total: 0 };
  if (!q) {
    const classes = isAdmin
      ? await db.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } })
      : await db.class.findMany({ where: { enrollments: { some: { studentId: session.user.id } } }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } });
    return { role: user.role, q, classes, exams: empty, documents: empty, questions: empty, totalPages: 1 };
  }

  const classId = filters.classId;
  const enrollment = { class: { enrollments: { some: { studentId: session.user.id } } } };
  const examClassWhere: Prisma.ExamClassWhereInput = isAdmin
    ? (classId ? { classId } : {})
    : { ...(classId ? { classId } : {}), ...enrollment };
  const documentClassWhere: Prisma.DocumentClassWhereInput = isAdmin
    ? (classId ? { classId } : {})
    : { ...(classId ? { classId } : {}), ...enrollment };
  const questionClassWhere: Prisma.ClassReviewQuestionWhereInput = isAdmin
    ? (classId ? { classId } : {})
    : { ...(classId ? { classId } : {}), ...enrollment };
  const now = new Date();
  const examWhere: Prisma.ExamWhereInput = {
    title: { contains: q, mode: "insensitive" },
    examLinks: { some: examClassWhere },
    ...(!isAdmin ? {
      status: "PUBLISHED" as const,
      OR: [
        { isForever: true },
        {
          isForever: false,
          AND: [
            { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
            { OR: [{ availableTo: null }, { availableTo: { gte: now } }] },
          ],
        },
      ],
    } : {}),
  };
  const documentWhere: Prisma.DocumentWhereInput = {
    OR: [{ title: { contains: q, mode: "insensitive" } }, { fileName: { contains: q, mode: "insensitive" } }],
    classLinks: { some: documentClassWhere },
  };
  const questionWhere: Prisma.ReviewQuestionWhereInput = {
    OR: [
      { content: { contains: q, mode: "insensitive" } },
      { topic: { contains: q, mode: "insensitive" } },
      { grade: { contains: q, mode: "insensitive" } },
      { chapter: { name: { contains: q, mode: "insensitive" } } },
    ],
    classLinks: { some: questionClassWhere },
  };
  const wantsExam = filters.type === "all" || filters.type === "exam";
  const wantsDocument = filters.type === "all" || filters.type === "document";
  const wantsQuestion = filters.type === "all" || filters.type === "question";

  const [examRows, examTotal, documentRows, documentTotal, questionRows, questionTotal, classes] = await Promise.all([
    wantsExam ? db.exam.findMany({ where: examWhere, select: { id: true, title: true, mode: true, status: true, folderId: true, examLinks: { where: examClassWhere, select: { class: { select: { code: true, name: true } } } } }, orderBy: { createdAt: "desc" }, skip, take: pageSize }) : Promise.resolve([]),
    wantsExam ? db.exam.count({ where: examWhere }) : Promise.resolve(0),
    wantsDocument ? db.document.findMany({ where: documentWhere, select: { id: true, title: true, fileName: true, contentType: true, folderId: true, classLinks: { where: documentClassWhere, select: { class: { select: { code: true, name: true } } } } }, orderBy: { createdAt: "desc" }, skip, take: pageSize }) : Promise.resolve([]),
    wantsDocument ? db.document.count({ where: documentWhere }) : Promise.resolve(0),
    wantsQuestion ? db.reviewQuestion.findMany({ where: questionWhere, select: { id: true, content: true, topic: true, grade: true, difficulty: true, chapter: { select: { id: true, name: true } }, classLinks: { where: questionClassWhere, select: { class: { select: { code: true, name: true } } } } }, orderBy: { createdAt: "desc" }, skip, take: pageSize }) : Promise.resolve([]),
    wantsQuestion ? db.reviewQuestion.count({ where: questionWhere }) : Promise.resolve(0),
    isAdmin
      ? db.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } })
      : db.class.findMany({ where: { enrollments: { some: { studentId: session.user.id } } }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const labels = await getFolderLabelsForResults([
    ...examRows.map((exam) => exam.folderId),
    ...documentRows.map((document) => document.folderId),
  ]);
  const classNames = (links: { class: { code: string; name: string } }[]) => links.map((link) => link.class.code + " · " + link.class.name);
  const exams: SearchItem[] = examRows.map((exam) => ({
    id: exam.id,
    title: exam.title,
    description: (exam.mode === "MOCK" ? "Thi thử" : "Luyện tập") + " · " + (exam.status === "DRAFT" ? "Bản nháp" : exam.status === "CLOSED" ? "Đã đóng" : "Đã xuất bản"),
    breadcrumb: exam.folderId ? labels.get(exam.folderId) ?? "" : "Thư mục gốc",
    classes: classNames(exam.examLinks),
    href: isAdmin ? "/admin/de-thi/" + exam.id + "/chinh-sua" : "/thi-thu/" + exam.id,
  }));
  const documents: SearchItem[] = documentRows.map((document) => ({
    id: document.id,
    title: document.title,
    description: document.fileName + " · " + document.contentType,
    breadcrumb: document.folderId ? labels.get(document.folderId) ?? "" : "Thư mục gốc",
    classes: classNames(document.classLinks),
    href: isAdmin ? "/admin/tai-lieu" : "/tai-lieu/" + document.id,
  }));
  const questions: SearchItem[] = questionRows.map((question) => ({
    id: question.id,
    title: question.content.slice(0, 240),
    description: [question.topic, question.grade ? "Khối " + question.grade : "", question.difficulty === "EASY" ? "Dễ" : question.difficulty === "HARD" ? "Khó" : "Trung bình"].filter(Boolean).join(" · "),
    breadcrumb: question.chapter.name,
    classes: classNames(question.classLinks),
    href: isAdmin ? "/admin/cau-hoi-on-tap?q=" + encodeURIComponent(question.content.slice(0, 100)) : "/on-tap/" + question.chapter.id,
  }));
  const totalPages = Math.max(1, Math.ceil(Math.max(examTotal, documentTotal, questionTotal) / pageSize));
  return {
    role: user.role,
    q,
    classes,
    exams: { items: exams, total: examTotal },
    documents: { items: documents, total: documentTotal },
    questions: { items: questions, total: questionTotal },
    totalPages,
  };
}
