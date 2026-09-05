import "server-only";

import type { AccountStatus, Role } from "@prisma/client";

import { db } from "@/lib/db";

export interface AccountAccessSnapshot {
  role: Role;
  status: AccountStatus;
  studentPhone: string | null;
  parentPhone: string | null;
  mustChangePassword: boolean;
}

/**
 * Một nơi duy nhất quyết định trang đến sau đăng nhập. Thứ tự là chủ ý:
 * tài khoản bị khóa luôn bị chặn trước; tài khoản Google PENDING vẫn được
 * hoàn tất hồ sơ rồi mới chuyển sang màn hình chờ giáo viên duyệt.
 */
export function getAccountDestination(account: AccountAccessSnapshot): string {
  if (account.status === "SUSPENDED") return "/tai-khoan-bi-khoa";

  if (account.role === "ADMIN") return "/admin";

  if (!account.studentPhone || !account.parentPhone) {
    return "/hoan-tat-ho-so";
  }
  if (account.status === "PENDING") return "/cho-duyet";
  if (account.mustChangePassword) return "/doi-mat-khau";

  return "/lop-hoc";
}

export async function findAccountAccess(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      status: true,
      studentPhone: true,
      parentPhone: true,
      mustChangePassword: true,
    },
  });
}
