"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasCurrentCredentialVersion } from "../lib/credential-version";
import {
  changePasswordForUser,
  type ChangePasswordInput,
  type ChangePasswordResult,
} from "../change-password-service";

export async function changePassword(
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  const session = await auth();
  if (!session?.user.id) {
    return { success: false, error: "Phiên đăng nhập không hợp lệ." };
  }
  try {
    const account = await db.user.findUnique({
      where: { id: session.user.id },
      select: { credentialVersion: true },
    });
    if (
      !account ||
      !hasCurrentCredentialVersion(
        session.user.credentialVersion,
        account.credentialVersion,
      )
    ) {
      return { success: false, error: "Phiên đăng nhập không còn hiệu lực." };
    }
    return await changePasswordForUser(session.user.id, input);
  } catch (error) {
    console.error("Đổi mật khẩu chủ động thất bại:", error);
    return { success: false, error: "Không thể đổi mật khẩu, vui lòng thử lại." };
  }
}
