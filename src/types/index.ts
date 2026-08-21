// Type dùng chung TOÀN APP (ví dụ: Role, ApiResponse<T>).
// Type riêng cho 1 module → để trong features/<module>/types.ts

export type Role = "ADMIN" | "STUDENT" | "GUEST";

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
