import "server-only";

import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

import {
  validateConfirmPassword,
  validateRegisterPassword,
} from "./lib/validation";

export type ChangePasswordInput = {
  currentPassword: string;
  password: string;
  confirmPassword: string;
};

export type ChangePasswordResult =
  | { success: true }
  | {
      success: false;
      error: string;
      field?: "currentPassword" | "password" | "confirmPassword";
    };

/** Core tách khỏi session để action và integration test dùng cùng một logic. */
export async function changePasswordForUser(
  userId: string,
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  if (!input.currentPassword || input.currentPassword.length > 128) {
    return {
      success: false,
      error: "Vui lòng nhập đúng mật khẩu hiện tại.",
      field: "currentPassword",
    };
  }
  const passwordError = validateRegisterPassword(input.password);
  if (passwordError) {
    return { success: false, error: passwordError, field: "password" };
  }
  const confirmError = validateConfirmPassword(input.confirmPassword, input.password);
  if (confirmError) {
    return { success: false, error: confirmError, field: "confirmPassword" };
  }

  const user = await db.user.findFirst({
    where: { id: userId, status: "ACTIVE" },
    select: { passwordHash: true },
  });
  if (!user) return { success: false, error: "Tài khoản không còn hoạt động." };
  if (!user.passwordHash) {
    return {
      success: false,
      error: "Tài khoản Google chưa có mật khẩu. Hãy dùng Quên mật khẩu để xác minh email và tạo mật khẩu.",
    };
  }

  const currentMatches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!currentMatches) {
    return {
      success: false,
      error: "Mật khẩu hiện tại không đúng.",
      field: "currentPassword",
    };
  }
  if (await verifyPassword(input.password, user.passwordHash)) {
    return {
      success: false,
      error: "Mật khẩu mới phải khác mật khẩu hiện tại.",
      field: "password",
    };
  }

  const passwordHash = await hashPassword(input.password);
  const updated = await db.user.updateMany({
    where: {
      id: userId,
      status: "ACTIVE",
      passwordHash: user.passwordHash,
    },
    data: { passwordHash, mustChangePassword: false },
  });
  if (updated.count !== 1) {
    return { success: false, error: "Mật khẩu vừa được thay đổi ở nơi khác. Hãy thử lại." };
  }
  return { success: true };
}
