import type { Metadata } from "next";

import { AdminClassesManager } from "@/features/classes/components/AdminClassesManager";
import { AdminWeeklyCalendar } from "@/features/classes/components/AdminWeeklyCalendar";
import { getAdminWeeklySchedule } from "@/features/classes/schedule-queries";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Lớp học | BQD Math" };
export const dynamic = "force-dynamic";

export default async function AdminClassesPage() {
  const [classRows, students, weeklySchedule] = await Promise.all([
    db.class.findMany({
      select: {
        id: true, name: true, level: true, schedule: true, description: true, status: true,
        scheduleSlots: { select: { dayOfWeek: true, startTime: true, endTime: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        announcements: { select: { id: true, title: true, content: true, isVisible: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 },
        enrollments: { select: { studentId: true } },
        documentLinks: { select: { id: true } },
        questionLinks: { select: { id: true } },
        examLinks: { select: { exam: { select: { attempts: { where: { submittedAt: { not: null } }, select: { userId: true, score: true } } } } } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    db.user.findMany({ where: { role: "STUDENT", status: "ACTIVE" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    getAdminWeeklySchedule(),
  ]);
  const classes = classRows.map((item) => {
    const attempts = item.examLinks.flatMap((link) => link.exam.attempts);
    const scores = attempts.map((attempt) => attempt.score).filter((score): score is number => score !== null);
    return {
      id: item.id, name: item.name, level: item.level, legacySchedule: item.schedule, scheduleSlots: item.scheduleSlots, description: item.description, status: item.status,
      studentIds: item.enrollments.map((row) => row.studentId),
      announcements: item.announcements.map((announcement) => ({ ...announcement, createdAt: announcement.createdAt.toISOString() })),
      counts: { students: item.enrollments.length, documents: item.documentLinks.length, questions: item.questionLinks.length, exams: item.examLinks.length },
      stats: { attempts: attempts.length, participants: new Set(attempts.map((attempt) => attempt.userId)).size, averageScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null },
    };
  });
  return (
    <section className="space-y-7">
      <div><h1 className="text-xl font-semibold text-navy-600">Lớp học & lịch dạy</h1><p className="mt-1 text-sm text-navy-300">Xem lịch tuần, tạo lớp, xếp học sinh và chỉnh từng buổi học trên cùng một trang.</p></div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.45fr)]">
        <div id="quan-ly-lop" className="min-w-0 scroll-mt-6 space-y-3"><div><h2 className="text-lg font-semibold text-navy-600">Chỉnh sửa lớp học</h2><p className="mt-1 text-xs text-navy-300">Thay đổi lịch ở đây sẽ cập nhật ngay sang cột lịch bên cạnh.</p></div><AdminClassesManager classes={classes} students={students} /></div>
        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start"><AdminWeeklyCalendar schedule={weeklySchedule.schedule} classCount={weeklySchedule.classCount} sessionCount={weeklySchedule.sessionCount} /></div>
      </div>
    </section>
  );
}
