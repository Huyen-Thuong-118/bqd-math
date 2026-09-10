"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { nextStudentCode } from "@/lib/management-codes";
import { generateTempPassword, hashPassword } from "@/lib/password";

type ActionResult =
  | { success: true; studentCode?: string; classIds?: string[] }
  | { success: false; error: string };
type ResetPasswordResult =
  | { success: true; temporaryPassword: string }
  | { success: false; error: string };

/**
 * Server action có thể bị gọi trực tiếp (bỏ qua UI, bỏ qua proxy chặn
 * /admin/**) — luôn tự kiểm tra role ở đây, không tin tưởng riêng proxy.
 */
async function assertAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user.id) {
    throw new Error("Chỉ ADMIN mới được thực hiện hành động này.");
  }

  const current = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, status: true },
  });
  if (current?.role !== "ADMIN" || current.status !== "ACTIVE") {
    throw new Error("Chỉ ADMIN đang hoạt động mới được thực hiện hành động này.");
  }
}

const ACCOUNTS_PAGE_PATH = "/admin/hoc-sinh";

async function createClassAnnouncementNotifications(
  transaction: Prisma.TransactionClient,
  userId: string,
  classIds: string[],
) {
  if (!classIds.length) return;
  const announcements = await transaction.classAnnouncement.findMany({
    where: { classId: { in: classIds }, isVisible: true },
    select: { id: true, classId: true, title: true, content: true, createdAt: true },
  });
  if (!announcements.length) return;
  await transaction.notification.createMany({
    data: announcements.map((announcement) => ({
      userId,
      type: "IN_APP" as const,
      title: announcement.title,
      content: announcement.content,
      href: `/lop-hoc/${announcement.classId}`,
      classAnnouncementId: announcement.id,
      sentAt: announcement.createdAt,
    })),
    skipDuplicates: true,
  });
}

export async function approveAccount(userId: string, classIds: string[] = []): Promise<ActionResult> {
  try {
    await assertAdmin();
    const normalizedClassIds = [...new Set(classIds.filter((id) => typeof id === "string" && id.length <= 100))];
    // + role: "STUDENT" trong where — chặn luôn trường hợp userId trỏ nhầm
    // (hoặc bị truyền cố ý) sang 1 tài khoản ADMIN khác.
    const account = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true, studentCode: true, studentPhone: true, parentPhone: true },
    });
    if (
      account?.role !== "STUDENT" ||
      account.status !== "PENDING" ||
      !account.studentPhone ||
      !account.parentPhone
    ) {
      return {
        success: false,
        error: "Học sinh phải hoàn tất hồ sơ và đang chờ duyệt.",
      };
    }

    const validClassCount = await db.class.count({
      where: { id: { in: normalizedClassIds }, status: "ACTIVE" },
    });
    if (validClassCount !== normalizedClassIds.length) {
      return { success: false, error: "Có lớp không tồn tại hoặc đã được lưu trữ." };
    }

    const studentCode = await db.$transaction(async (transaction) => {
      const code = account.studentCode ?? await nextStudentCode(transaction);
      await transaction.user.update({
        where: { id: userId, role: "STUDENT", status: "PENDING" },
        data: { status: "ACTIVE", studentCode: code },
      });

      if (normalizedClassIds.length) {
        await transaction.classEnrollment.createMany({
          data: normalizedClassIds.map((classId) => ({ classId, studentId: userId })),
          skipDuplicates: true,
        });

        await createClassAnnouncementNotifications(transaction, userId, normalizedClassIds);
      }
      return code;
    });
    revalidatePath(ACCOUNTS_PAGE_PATH);
    revalidatePath("/admin/lop-hoc");
    revalidatePath("/lop-hoc");
    return { success: true, studentCode, classIds: normalizedClassIds };
  } catch (error) {
    console.error("approveAccount thất bại:", error);
    return { success: false, error: "Không thể duyệt tài khoản, vui lòng thử lại." };
  }
}

export async function setStudentClasses(userId: string, classIds: string[]): Promise<ActionResult> {
  try {
    await assertAdmin();
    const normalizedClassIds = [...new Set(classIds.filter((id) => typeof id === "string" && id.length <= 100))];
    const [student, validClassCount] = await Promise.all([
      db.user.findFirst({
        where: { id: userId, role: "STUDENT", status: "ACTIVE" },
        select: { id: true, classEnrollments: { select: { classId: true } } },
      }),
      db.class.count({ where: { id: { in: normalizedClassIds }, status: "ACTIVE" } }),
    ]);
    if (!student) return { success: false, error: "Không tìm thấy học sinh đang hoạt động." };
    if (validClassCount !== normalizedClassIds.length) {
      return { success: false, error: "Có lớp không tồn tại hoặc đã được lưu trữ." };
    }

    const currentIds = new Set(student.classEnrollments.map((enrollment) => enrollment.classId));
    const addedClassIds = normalizedClassIds.filter((classId) => !currentIds.has(classId));
    await db.$transaction(async (transaction) => {
      await transaction.classEnrollment.deleteMany({
        where: { studentId: userId, classId: { notIn: normalizedClassIds } },
      });
      if (normalizedClassIds.length) {
        await transaction.classEnrollment.createMany({
          data: normalizedClassIds.map((classId) => ({ classId, studentId: userId })),
          skipDuplicates: true,
        });
      }
      await createClassAnnouncementNotifications(transaction, userId, addedClassIds);
    });

    revalidatePath(ACCOUNTS_PAGE_PATH);
    revalidatePath("/admin/lop-hoc");
    revalidatePath("/lop-hoc");
    revalidatePath("/theo-doi-hoc-tap");
    revalidatePath("/thong-bao");
    return { success: true, classIds: normalizedClassIds };
  } catch (error) {
    console.error("setStudentClasses thất bại:", error);
    return { success: false, error: "Không thể cập nhật lớp học cho học sinh." };
  }
}

export async function rejectAccount(userId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    // Xoá HẲN (không chỉ đổi status) — đúng ý nghĩa "từ chối" 1 hồ sơ PENDING
    // chưa từng được duyệt, và cho phép đăng ký lại với cùng email/SĐT sau này.
    await db.user.delete({
      where: { id: userId, role: "STUDENT", status: "PENDING" },
    });
    revalidatePath(ACCOUNTS_PAGE_PATH);
    return { success: true };
  } catch (error) {
    console.error("rejectAccount thất bại:", error);
    return { success: false, error: "Không thể từ chối tài khoản, vui lòng thử lại." };
  }
}

export async function revokeAccount(userId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    await db.user.update({
      where: { id: userId, role: "STUDENT", status: "ACTIVE" },
      data: { status: "SUSPENDED", suspendedAt: new Date() },
    });
    revalidatePath(ACCOUNTS_PAGE_PATH);
    return { success: true };
  } catch (error) {
    console.error("revokeAccount thất bại:", error);
    return { success: false, error: "Không thể thu hồi quyền, vui lòng thử lại." };
  }
}

export async function reactivateAccount(userId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    await db.user.update({
      where: { id: userId, role: "STUDENT", status: "SUSPENDED" },
      data: { status: "ACTIVE", suspendedAt: null },
    });
    revalidatePath(ACCOUNTS_PAGE_PATH);
    return { success: true };
  } catch (error) {
    console.error("reactivateAccount thất bại:", error);
    return {
      success: false,
      error: "Không thể kích hoạt lại tài khoản, vui lòng thử lại.",
    };
  }
}

/**
 * Không thể xem lại mật khẩu cũ vì DB chỉ lưu bcrypt hash. Action này sinh
 * mật khẩu tạm, trả về đúng một lần cho admin và buộc học sinh đổi sau login.
 */
export async function resetStudentPassword(
  userId: string,
): Promise<ResetPasswordResult> {
  try {
    await assertAdmin();
    const temporaryPassword = generateTempPassword(12);
    const passwordHash = await hashPassword(temporaryPassword);

    await db.user.update({
      where: { id: userId, role: "STUDENT", status: "ACTIVE" },
      data: { passwordHash, mustChangePassword: true },
    });
    revalidatePath(ACCOUNTS_PAGE_PATH);
    return { success: true, temporaryPassword };
  } catch (error) {
    console.error("resetStudentPassword thất bại:", error);
    return {
      success: false,
      error: "Chỉ có thể đặt lại mật khẩu cho học sinh đang hoạt động.",
    };
  }
}
