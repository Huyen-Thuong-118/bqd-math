"use server";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { generateStudentCode } from "@/lib/management-codes";
import { hashPassword } from "@/lib/password";
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateParentPhone,
  validatePhone,
  validateRegisterPassword,
} from "../lib/validation";

interface RegisterInput {
  fullName: string;
  studentPhone: string;
  parentPhone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type RegisterResult =
  | { success: true }
  | { success: false; error: string; field?: "email" | "studentPhone" };

/**
 * Đăng ký HS — validate lại y hệt rule client (features/auth/lib/validation)
 * vì client-side validate bỏ qua được. Tạo user với status PENDING, chờ admin
 * duyệt ở /admin/hoc-sinh (features/accounts).
 */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  const { fullName, studentPhone, parentPhone, email, password, confirmPassword } = input;

  const fieldError =
    validateFullName(fullName) ??
    validatePhone(studentPhone) ??
    validateParentPhone(parentPhone, studentPhone) ??
    validateEmail(email) ??
    validateRegisterPassword(password) ??
    validateConfirmPassword(confirmPassword, password);

  if (fieldError) {
    return { success: false, error: fieldError };
  }

  try {
    const existing = await db.user.findFirst({
      where: { OR: [{ email }, { studentPhone }] },
      select: { email: true, studentPhone: true },
    });

    if (existing) {
      if (existing.email === email) {
        return { success: false, error: "Email đã được đăng ký", field: "email" };
      }
      return {
        success: false,
        error: "Số điện thoại đã được đăng ký",
        field: "studentPhone",
      };
    }

    // Dùng chung hashPassword() (lib/password.ts, 12 rounds) thay vì tự gọi
    // bcrypt riêng ở đây — tránh 2 nơi cấu hình round số khác nhau trong
    // cùng 1 app (không ảnh hưởng bcrypt.compare: round số đã nằm sẵn
    // trong chuỗi hash, verify vẫn đúng dù rounds khác nhau giữa các user).
    const passwordHash = await hashPassword(password);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await db.user.create({
          data: {
            name: fullName,
            studentCode: generateStudentCode(),
            studentPhone,
            parentPhone,
            email,
            passwordHash,
            role: "STUDENT",
            status: "PENDING",
          },
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
    console.error("Đăng ký thất bại:", error);
    return { success: false, error: "Đã có lỗi xảy ra, vui lòng thử lại." };
  }
}
