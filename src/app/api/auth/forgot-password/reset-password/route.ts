import { hashPassword } from "@/lib/password";
import { consumePasswordResetGrant } from "@/features/auth/password-recovery";
import {
  validateConfirmPassword,
  validateRegisterPassword,
} from "@/features/auth/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resetToken = typeof body?.resetToken === "string" ? body.resetToken : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    const confirmPassword =
      typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

    if (!resetToken || resetToken.length > 128) {
      return Response.json(
        {
          error:
            "Phiên đặt lại mật khẩu đã hết hạn, vui lòng thực hiện lại từ đầu",
        },
        { status: 400 },
      );
    }

    // Validate lại y hệt rule đăng ký (features/auth/lib/validation.ts) —
    // client đã chặn trước nhưng không tin tưởng dữ liệu gửi từ client.
    const fieldError =
      validateRegisterPassword(newPassword) ??
      validateConfirmPassword(confirmPassword, newPassword);
    if (fieldError) {
      return Response.json({ error: fieldError }, { status: 400 });
    }

    // Dùng chung hashPassword() (lib/password.ts, 12 rounds) — cùng lý do đã
    // ghi ở features/auth/actions/register.ts: tránh 2 nơi cấu hình bcrypt
    // rounds khác nhau trong cùng 1 app.
    const passwordHash = await hashPassword(newPassword);
    const consumed = await consumePasswordResetGrant(resetToken, passwordHash);
    if (!consumed) {
      return Response.json(
        {
          error:
            "Phiên đặt lại mật khẩu đã hết hạn, vui lòng thực hiện lại từ đầu",
        },
        { status: 400 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Lỗi xử lý reset-password:", error);
    return Response.json(
      { error: "Đã có lỗi xảy ra, vui lòng thử lại." },
      { status: 500 },
    );
  }
}
