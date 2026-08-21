# features/auth

Đăng nhập/đăng ký, phân quyền 3 role: `ADMIN` (giáo viên), `STUDENT`, `GUEST`.

⚠️ Đọc [`SECURITY.md`](../../../SECURITY.md) ở gốc repo trước khi implement
module này — đặc biệt phần mật khẩu (không bao giờ cho admin xem lại mật
khẩu HS, chỉ có chức năng Reset).

## Đã có

- `lib/password.ts` — `hashPassword()`, `verifyPassword()`, `generateTempPassword()`

## Sẽ chứa

- `actions.ts` — server actions: `login()`, `register()`, `resetStudentPassword()`
  (admin dùng cái này thay vì xem lại mật khẩu cũ)
- `session.ts` — helper lấy user hiện tại từ session (dùng trong Server Component)
- `types.ts` — `type Role = "ADMIN" | "STUDENT" | "GUEST"`

**Liên quan:** `lib/auth.ts` (cấu hình NextAuth), `prisma/schema.prisma` model `User`.
