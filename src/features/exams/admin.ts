import "server-only";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function requireActiveAdminId() {
  const session = await auth();
  if (!session?.user.id) throw new Error("Bạn chưa đăng nhập.");
  const admin = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, status: true },
  });
  if (admin?.role !== "ADMIN" || admin.status !== "ACTIVE") {
    throw new Error("Chỉ giáo viên đang hoạt động được quản lý đề.");
  }
  return session.user.id;
}
