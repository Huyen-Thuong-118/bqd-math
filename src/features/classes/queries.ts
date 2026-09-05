import "server-only";

import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { requireActiveStudentId } from "@/features/exams/access";

export async function getClassesForCurrentStudent() {
  const studentId = await requireActiveStudentId();
  return db.class.findMany({
    where: { enrollments: { some: { studentId } } },
    select: {
      id: true,
      name: true,
      level: true,
      schedule: true,
      scheduleSlots: { select: { dayOfWeek: true, startTime: true, endTime: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      description: true,
      status: true,
      _count: { select: { enrollments: true, documentLinks: true, examLinks: true, questionLinks: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function getClassForCurrentStudent(classId: string) {
  const studentId = await requireActiveStudentId();
  const classroom = await db.class.findFirst({
    // Ownership được đặt ngay trong query, không fetch theo id rồi kiểm tra ở client.
    where: { id: classId, enrollments: { some: { studentId } } },
    select: {
      id: true,
      name: true,
      level: true,
      schedule: true,
      scheduleSlots: { select: { dayOfWeek: true, startTime: true, endTime: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      description: true,
      status: true,
      announcements: { where: { isVisible: true }, orderBy: { createdAt: "desc" }, take: 20 },
      documentLinks: {
        select: { document: { select: { id: true, title: true, fileName: true, allowDownload: true, answerUrl: true, showAnswer: true, updateCount: true, createdAt: true } } },
        orderBy: { document: { createdAt: "desc" } },
      },
      examLinks: {
        where: { exam: { status: { in: ["PUBLISHED", "CLOSED"] } } },
        select: { exam: { select: { id: true, title: true, mode: true, status: true, availableTo: true } } },
        orderBy: { exam: { createdAt: "desc" } },
      },
      questionLinks: {
        select: { question: { select: { id: true, content: true, chapter: { select: { id: true, name: true } } } } },
        take: 8,
        orderBy: { question: { createdAt: "desc" } },
      },
    },
  });
  if (!classroom) notFound();
  return classroom;
}
