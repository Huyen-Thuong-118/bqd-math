import "server-only";

import { requireActiveStudentId } from "@/features/exams/access";
import { db } from "@/lib/db";
import type { StudentNotification } from "./types";

export async function getOptionalUnreadNotificationCount() {
  try {
    const studentId = await requireActiveStudentId();
    return db.notification.count({
      where: {
        userId: studentId,
        type: "IN_APP",
        readAt: null,
        classAnnouncement: {
          isVisible: true,
          class: { enrollments: { some: { studentId } } },
        },
      },
    });
  } catch {
    return 0;
  }
}

export async function getStudentNotifications(limit = 50): Promise<StudentNotification[]> {
  const studentId = await requireActiveStudentId();
  const notifications = await db.notification.findMany({
    where: {
      userId: studentId,
      type: "IN_APP",
      classAnnouncement: {
        isVisible: true,
        class: { enrollments: { some: { studentId } } },
      },
    },
    select: {
      id: true,
      title: true,
      content: true,
      href: true,
      readAt: true,
      sentAt: true,
      classAnnouncement: { select: { class: { select: { name: true } } } },
    },
    orderBy: { sentAt: "desc" },
    take: Math.max(1, Math.min(limit, 100)),
  });

  return notifications.map((notification) => ({
    id: notification.id,
    title: notification.title ?? "Thông báo mới",
    content: notification.content,
    href: notification.href ?? "/thong-bao",
    readAt: notification.readAt?.toISOString() ?? null,
    sentAt: notification.sentAt.toISOString(),
    className: notification.classAnnouncement?.class.name ?? null,
  }));
}
