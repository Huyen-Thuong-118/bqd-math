import { db } from "@/lib/db";
import { verifyPasswordResetOtp } from "@/features/auth/password-recovery";

// Message DUY NHẤT cho mọi lý do thất bại (email không tồn tại, sai mã, hết
// hạn, đã dùng...) — không phân biệt để tránh lộ email nào có tồn tại.
const OTP_ERROR = "Mã OTP không đúng hoặc đã hết hạn";

function errorResponse() {
  return Response.json({ error: OTP_ERROR }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const otp = typeof body?.otp === "string" ? body.otp.trim() : "";
    if (!email || email.length > 320 || !/^\d{6}$/.test(otp)) return errorResponse();

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return errorResponse();

    const resetToken = await verifyPasswordResetOtp(user.id, otp);
    if (!resetToken) return errorResponse();
    return Response.json({ resetToken });
  } catch (error) {
    console.error("Lỗi xử lý verify-otp:", error);
    return errorResponse();
  }
}
