"use server";

import { revalidatePath } from "next/cache";

import { requireActiveStudentId } from "@/features/exams/access";
import { db } from "@/lib/db";

export async function markAllNotificationsRead() {
  const studentId = await requireActiveStudentId();
  await db.notification.updateMany({
    where: { userId: studentId, type: "IN_APP", readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/thong-bao");
  return { success: true } as const;
}
