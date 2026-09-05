import "server-only";

import { requireActiveStudentId } from "@/features/exams/access";
import { requireActiveAdminId } from "@/features/exams/admin";
import { groupByDay } from "@/features/home/data";
import type { ClassSession } from "@/features/home/types";
import { db } from "@/lib/db";

type ScheduleScope = "PUBLIC" | "ADMIN" | "STUDENT";

async function getSchedule(scope: ScheduleScope, studentId?: string) {
  const classes = await db.class.findMany({
    where: scope === "ADMIN"
      ? undefined
      : scope === "STUDENT"
        ? { status: "ACTIVE", enrollments: { some: { studentId } } }
        : { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      level: true,
      status: true,
      scheduleSlots: {
        select: { id: true, dayOfWeek: true, startTime: true, endTime: true },
      },
    },
    orderBy: { name: "asc" },
  });
  const sessions: ClassSession[] = classes.flatMap((classroom) =>
    classroom.scheduleSlots.map((slot) => ({
      id: slot.id,
      classId: classroom.id,
      className: classroom.name,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      level: classroom.level,
      status: classroom.status,
    })),
  );
  return {
    schedule: groupByDay(sessions),
    classCount: classes.filter((classroom) => classroom.scheduleSlots.length > 0).length,
    sessionCount: sessions.length,
  };
}

export async function getPublicWeeklySchedule() {
  return getSchedule("PUBLIC");
}

export async function getAdminWeeklySchedule() {
  await requireActiveAdminId();
  return getSchedule("ADMIN");
}

export async function getStudentWeeklySchedule() {
  const studentId = await requireActiveStudentId();
  return getSchedule("STUDENT", studentId);
}
