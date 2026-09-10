import type { User } from "@prisma/client";

export type AccountStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

/** Thêm "ALL" cho tab lọc — không phải trạng thái tài khoản thật nên tách
 * riêng khỏi AccountStatus thay vì nhét vào đó. */
export type AccountFilter = "ALL" | AccountStatus;

/**
 * Đúng field thật của model User (Pick từ type Prisma sinh ra, không tự khai
 * báo lại) — tránh lệch tên/kiểu với schema.prisma theo thời gian. Field tên
 * là "name"/"createdAt" (không phải "fullName"/"registeredAt") vì đây chính
 * là cột trong DB, không qua lớp map nào cả (page.tsx truyền thẳng kết quả
 * prisma.user.findMany xuống AccountsPage).
 */
export type StudentAccount = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "studentCode"
  | "studentPhone"
  | "parentPhone"
  | "status"
  | "createdAt"
  | "suspendedAt"
> & {
  classIds: string[];
  classNames: string[];
};
