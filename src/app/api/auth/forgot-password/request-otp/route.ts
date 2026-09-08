import { db } from "@/lib/db";
import { issuePasswordResetOtp } from "@/features/auth/password-recovery";
import { sendOtpEmail } from "@/features/auth/lib/mailer";

// LUÔN trả về đúng 1 message, bất kể email có tồn tại/bị rate-limit/gửi mail
// lỗi hay không — chống dò email nào đã đăng ký trong hệ thống.
// Tạo Response MỚI mỗi lần gọi: body của Response là stream, dùng lại 1
// instance cho nhiều request sẽ lỗi "body already used" ở request thứ 2.
function genericResponse() {
  return Response.json({
    message: "Nếu email tồn tại trong hệ thống, mã OTP đã được gửi",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (!email || email.length > 320) return genericResponse();

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return genericResponse();

    const otp = await issuePasswordResetOtp(user.id);
    if (!otp) return genericResponse();

    try {
      await sendOtpEmail(user.email, user.name, otp);
    } catch (error) {
      console.error("Gửi email OTP thất bại:", error);
    }
  } catch (error) {
    console.error("Lỗi xử lý request-otp:", error);
  }

  return genericResponse();
}
