import { db } from "@/lib/db";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Gọi mỗi ngày qua Vercel Cron (xem vercel.json) — xoá vĩnh viễn tài khoản
// SUSPENDED quá 30 ngày kể từ suspendedAt (xem STATUS_LIFECYCLE trong
// prisma/schema.prisma). Mọi relation trỏ từ User (Account, Session,
// PasswordResetOtp, ClassEnrollment, ExamAttempt, ReviewAttempt, Notification)
// đã có onDelete: Cascade trong schema — deleteMany() xoá sạch, không cần
// dọn tay các bảng con.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // Thiếu CRON_SECRET: KHÔNG được so sánh authHeader với `Bearer ${undefined}`
  // — ai gửi đúng chuỗi "Bearer undefined" sẽ vượt qua được. Chặn cứng luôn
  // thay vì để lộ lỗ hổng khi quên set biến môi trường.
  if (!cronSecret) {
    console.error("CRON_SECRET chưa được cấu hình — từ chối mọi request.");
    return new Response("Unauthorized", { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
    const result = await db.user.deleteMany({
      where: { status: "SUSPENDED", suspendedAt: { lte: cutoff } },
    });

    return Response.json({ deleted: result.count });
  } catch (error) {
    console.error("cleanup-suspended-accounts thất bại:", error);
    return Response.json({ error: "Cleanup thất bại" }, { status: 500 });
  }
}
