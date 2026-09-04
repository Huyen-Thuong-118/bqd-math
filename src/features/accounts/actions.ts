"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/lib/db";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Server action có thể bị gọi trực tiếp (bỏ qua UI, bỏ qua proxy chặn
 * /admin/**) — luôn tự kiểm tra role ở đây, không tin tưởng riêng proxy.
 */
async function assertAdmin(): Promise<void> {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    throw new Error("Chỉ ADMIN mới được thực hiện hành động này.");
  }
}

const ACCOUNTS_PAGE_PATH = "/admin/hoc-sinh";

export async function approveAccount(userId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    // + role: "STUDENT" trong where — chặn luôn trường hợp userId trỏ nhầm
    // (hoặc bị truyền cố ý) sang 1 tài khoản ADMIN khác.
    await db.user.update({
      where: { id: userId, role: "STUDENT" },
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
    await db.user.delete({ where: { id: userId, role: "STUDENT" } });
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
      where: { id: userId, role: "STUDENT" },
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
      where: { id: userId, role: "STUDENT" },
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
