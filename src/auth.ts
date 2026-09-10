import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { isGoogleAuthConfigured } from "@/features/auth/lib/google-auth";

// `code` là phần LoginForm.tsx đọc lại từ `result.code` sau signIn() để chọn
// đúng câu thông báo — KHÔNG đổi các chuỗi này mà không sửa luôn bên đó.
class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid-credentials";
}
class AccountPendingError extends CredentialsSignin {
  code = "account-pending";
}
class AccountSuspendedError extends CredentialsSignin {
  code = "account-suspended";
}

// route.ts dùng `export { GET, POST } from "@/auth"` (destructure thẳng ra
// GET/POST ở đây, không export `handlers`) — đúng pattern Auth.js v5.
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(db),
  // Bắt buộc "jwt": Credentials provider không tương thích với strategy
  // "database" (user đăng nhập bằng mật khẩu không đi qua Adapter).
  session: { strategy: "jwt" },
  pages: {
    signIn: "/dang-nhap",
  },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Tài khoản, email hoặc số điện thoại" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        const identifier = credentials?.identifier;
        const password = credentials?.password;
        if (typeof identifier !== "string" || typeof password !== "string") {
          throw new InvalidCredentialsError();
        }

        const user = await db.user.findFirst({
          where: { OR: [{ email: identifier }, { studentPhone: identifier }] },
        });

        if (!user || !user.passwordHash) {
          // Không tồn tại HOẶC tài khoản chỉ đăng ký qua Google (chưa có mật
          // khẩu) — gộp chung 1 lỗi để không lộ tài khoản nào tồn tại.
          throw new InvalidCredentialsError();
        }
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          throw new InvalidCredentialsError();
        }

        // Chỉ trả trạng thái tài khoản sau khi mật khẩu đã đúng. Nếu kiểm tra
        // trước, người lạ có thể dò email/SĐT nào tồn tại và đang ở trạng thái
        // gì chỉ bằng một mật khẩu bất kỳ.
        if (user.status === "PENDING") {
          throw new AccountPendingError();
        }
        if (user.status === "SUSPENDED") {
          throw new AccountSuspendedError();
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
    ...(isGoogleAuthConfigured()
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // Google chỉ trả email đã xác minh. Cho phép nối OAuth vào đúng
            // tài khoản đã seed/đăng ký cùng email (đặc biệt là ADMIN), thay
            // vì báo OAuthAccountNotLinked và tạo một tài khoản trùng.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // `user` chỉ có ở lần đăng nhập đầu (từ authorize() hoặc từ Adapter) —
      // các lần refresh JWT sau đó chỉ có `token`.
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.status = user.status;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.status = token.status;
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
});
