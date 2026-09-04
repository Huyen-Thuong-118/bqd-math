import { db } from "@/lib/db";
import { generateOtp, hashOtp } from "@/features/auth/lib/otp";
import { sendOtpEmail } from "@/features/auth/lib/mailer";

const OTP_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

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
    if (!email) return genericResponse();

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return genericResponse();

    const recentCount = await db.passwordResetOtp.count({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentCount >= RATE_LIMIT_MAX) return genericResponse();

    const otp = generateOtp();
    await db.passwordResetOtp.create({
      data: {
        userId: user.id,
        codeHash: hashOtp(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

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
