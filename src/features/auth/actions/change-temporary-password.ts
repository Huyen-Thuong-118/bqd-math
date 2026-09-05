"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  validateConfirmPassword,
  validateRegisterPassword,
} from "../lib/validation";

interface ChangeTemporaryPasswordInput {
  password: string;
  confirmPassword: string;
}

type ChangeTemporaryPasswordResult =
  | { success: true }
  | { success: false; error: string; field?: "password" | "confirmPassword" };

export async function changeTemporaryPassword(
  input: ChangeTemporaryPasswordInput,
): Promise<ChangeTemporaryPasswordResult> {
  const session = await auth();
  if (!session?.user.id) {
    return { success: false, error: "Phiên đăng nhập không hợp lệ." };
  }

  const passwordError = validateRegisterPassword(input.password);
  if (passwordError) {
    return { success: false, error: passwordError, field: "password" };
  }
  const confirmError = validateConfirmPassword(
    input.confirmPassword,
    input.password,
  );
  if (confirmError) {
    return { success: false, error: confirmError, field: "confirmPassword" };
  }

  try {
    const passwordHash = await hashPassword(input.password);
    const result = await db.user.updateMany({
      where: {
        id: session.user.id,
        role: "STUDENT",
        status: "ACTIVE",
        mustChangePassword: true,
      },
      data: { passwordHash, mustChangePassword: false },
    });

    if (result.count !== 1) {
      return { success: false, error: "Yêu cầu đổi mật khẩu không còn hiệu lực." };
    }
    return { success: true };
  } catch (error) {
    console.error("Đổi mật khẩu tạm thất bại:", error);
    return { success: false, error: "Không thể đổi mật khẩu, vui lòng thử lại." };
  }
}
