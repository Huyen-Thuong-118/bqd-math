import "server-only";

import { requireActiveStudentId } from "@/features/exams/access";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export async function getDocumentsForCurrentStudent() {
  const studentId = await requireActiveStudentId();
  return db.document.findMany({
    // Điều kiện studentId nằm trong chính query dữ liệu học sinh.
    where: { classLinks: { some: { class: { enrollments: { some: { studentId } } } } } },
    select: {
      id: true, title: true, fileName: true, contentType: true, allowDownload: true,
      answerUrl: true, showAnswer: true, updateCount: true, createdAt: true,
      folder: { select: { id: true, name: true, parent: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } } } },
      classLinks: {
        where: { class: { enrollments: { some: { studentId } } } },
        select: { class: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDocumentForCurrentStudent(documentId: string) {
  const studentId = await requireActiveStudentId();
  const document = await db.document.findFirst({
    where: { id: documentId, classLinks: { some: { class: { enrollments: { some: { studentId } } } } } },
    select: { id: true, title: true, fileName: true, contentType: true, allowDownload: true, answerUrl: true, showAnswer: true, updateCount: true },
  });
  if (!document) notFound();
  const user = await db.user.findFirst({ where: { id: studentId }, select: { name: true } });
  return { ...document, studentName: user?.name ?? "Học sinh" };
}
