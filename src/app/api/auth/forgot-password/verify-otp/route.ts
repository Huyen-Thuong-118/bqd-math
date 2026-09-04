import { db } from "@/lib/db";
import { hashOtp } from "@/features/auth/lib/otp";
import { signResetToken } from "@/features/auth/lib/reset-token";

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
    if (!email || !otp) return errorResponse();

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return errorResponse();

    const record = await db.passwordResetOtp.findFirst({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record || record.codeHash !== hashOtp(otp)) {
      return errorResponse();
    }

    // Dùng 1 lần: đánh dấu consumed NGAY khi khớp, trước khi ký token — thử
    // lại đúng mã này lần 2 (kể cả trong 5 phút hiệu lực) sẽ bị từ chối.
    await db.passwordResetOtp.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    const resetToken = await signResetToken(user.id);
    return Response.json({ resetToken });
  } catch (error) {
    console.error("Lỗi xử lý verify-otp:", error);
    return errorResponse();
  }
}
