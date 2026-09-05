import "server-only";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ExamAccessError } from "./errors";

export { ExamAccessError } from "./errors";

export async function requireActiveStudentId(): Promise<string> {
  const session = await auth();
  if (!session?.user.id) throw new ExamAccessError("Bạn chưa đăng nhập.", 401);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      status: true,
      studentPhone: true,
      parentPhone: true,
      mustChangePassword: true,
    },
  });
  if (
    user?.role !== "STUDENT" ||
    user.status !== "ACTIVE" ||
    !user.studentPhone ||
    !user.parentPhone ||
    user.mustChangePassword
  ) {
    throw new ExamAccessError("Tài khoản học sinh không có quyền thực hiện.", 403);
  }
  return session.user.id;
}
