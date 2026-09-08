import type { AccountStatus, Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Module augmentation bắt buộc phải có để gắn thêm field custom (role, status,
// mustChangePassword) vào Session/JWT/User của Auth.js — không có file này,
// session.user.role sẽ không tồn tại ở phía type (dù chạy đúng ở runtime).
// Xem https://authjs.dev/getting-started/typescript#module-augmentation

declare module "next-auth" {
  interface User {
    role: Role;
    status: AccountStatus;
    mustChangePassword: boolean;
    credentialVersion: number;
    // Chỉ cần đọc trong callbacks.signIn để phát hiện user Google mới (chưa
    // hoàn tất hồ sơ) — KHÔNG lộ ra session.user (xem auth.ts).
    studentPhone?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      status: AccountStatus;
      mustChangePassword: boolean;
      credentialVersion: number;
    } & DefaultSession["user"];
  }
}

// "next-auth/jwt" chỉ re-export kiểu `export *` từ "@auth/core/jwt" — augment
// qua đường đó không merge vào chỗ @auth/core tự import JWT cho callback
// jwt/session, nên phải augment thẳng "@auth/core/jwt" (module gốc khai báo
// interface JWT) mới có tác dụng. Augment cả 2 cho chắc, không thừa.
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: AccountStatus;
    mustChangePassword: boolean;
    credentialVersion: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: AccountStatus;
    mustChangePassword: boolean;
    credentialVersion: number;
  }
}
