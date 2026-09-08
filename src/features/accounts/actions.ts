"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { hasCurrentCredentialVersion } from "@/features/auth/lib/credential-version";
import { db } from "@/lib/db";
import { generateTempPassword, hashPassword } from "@/lib/password";

type ActionResult = { success: true } | { success: false; error: string };
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
    select: { role: true, status: true, credentialVersion: true },
  });
  if (
    current?.role !== "ADMIN" ||
    current.status !== "ACTIVE" ||
    !hasCurrentCredentialVersion(session.user.credentialVersion, current.credentialVersion)
  ) {
    throw new Error("Chỉ ADMIN đang hoạt động mới được thực hiện hành động này.");
  }
}

const ACCOUNTS_PAGE_PATH = "/admin/hoc-sinh";

export async function approveAccount(userId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    // + role: "STUDENT" trong where — chặn luôn trường hợp userId trỏ nhầm
    // (hoặc bị truyền cố ý) sang 1 tài khoản ADMIN khác.
    const account = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true, studentPhone: true, parentPhone: true },
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

    await db.user.update({
      where: { id: userId, role: "STUDENT", status: "PENDING" },
      data: { status: "ACTIVE" },
    });
    revalidatePath(ACCOUNTS_PAGE_PATH);
    return { success: true };
  } catch (error) {
    console.error("approveAccount thất bại:", error);
    return { success: false, error: "Không thể duyệt tài khoản, vui lòng thử lại." };
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
      data: {
        passwordHash,
        mustChangePassword: true,
        credentialVersion: { increment: 1 },
      },
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
