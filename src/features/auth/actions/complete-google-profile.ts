"use server";

import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateStudentCode } from "@/lib/management-codes";
import { validateParentPhone, validatePhone } from "../lib/validation";

interface CompleteProfileInput {
  studentPhone: string;
  parentPhone: string;
}

type CompleteProfileResult =
  | { success: true }
  | {
      success: false;
      error: string;
      field?: "studentPhone" | "parentPhone";
    };

export async function completeGoogleProfile(
  input: CompleteProfileInput,
): Promise<CompleteProfileResult> {
  const session = await auth();
  if (!session?.user.id || session.user.role !== "STUDENT") {
    return { success: false, error: "Phiên đăng nhập không hợp lệ." };
  }

  const studentPhone = input.studentPhone.trim();
  const parentPhone = input.parentPhone.trim();
  const studentPhoneError = validatePhone(studentPhone);
  if (studentPhoneError) {
    return { success: false, error: studentPhoneError, field: "studentPhone" };
  }
  const parentPhoneError = validateParentPhone(parentPhone, studentPhone);
  if (parentPhoneError) {
    return { success: false, error: parentPhoneError, field: "parentPhone" };
  }

  try {
    const current = await db.user.findUnique({ where: { id: session.user.id }, select: { studentCode: true } });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await db.user.update({
          where: { id: session.user.id, role: "STUDENT" },
          data: { studentPhone, parentPhone, studentCode: current?.studentCode ?? generateStudentCode() },
        });
        return { success: true };
      } catch (error) {
        const target = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
          ? JSON.stringify(error.meta?.target ?? "")
          : "";
        if (target.includes("studentCode") && attempt < 3) continue;
        throw error;
      }
    }
    return { success: false, error: "Không thể cấp mã học sinh, vui lòng thử lại." };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "Số điện thoại học sinh đã được tài khoản khác sử dụng.",
        field: "studentPhone",
      };
    }
    console.error("Hoàn tất hồ sơ Google thất bại:", error);
    return { success: false, error: "Không thể lưu hồ sơ, vui lòng thử lại." };
  }
}
