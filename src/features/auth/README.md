# features/auth

Đăng nhập/đăng ký, phân quyền 2 role: `ADMIN` (giáo viên, seed sẵn qua
`prisma/seed.ts`, không đăng ký) và `STUDENT` (đăng ký qua form, chờ duyệt).

⚠️ Đọc [`docs/security.md`](../../../docs/security.md) trước khi implement
module này — đặc biệt phần mật khẩu (không bao giờ cho admin xem lại mật
khẩu HS, chỉ có chức năng Reset).

## Đã có

- `lib/validation.ts` — validate tay (chưa cài zod) cho cả 3 form UI
- `actions/register.ts` — server action đăng ký, validate lại y hệt client
- `components/` — LoginForm, RegisterForm, ForgotPasswordFlow, GoogleAuthButton,
  MathDoodles (UI, dùng ở `app/(auth)/`)
- `actions/change-password.ts` + `ChangePasswordForm` — người dùng ACTIVE đổi
  mật khẩu khi đang đăng nhập, bắt buộc xác minh mật khẩu cũ và đăng xuất sau
  thành công. Google-only được hướng qua OTP thay vì đặt mật khẩu từ session.

JWT đã phát hành trên thiết bị khác chưa bị revoke khi đổi mật khẩu; nếu cần
thu hồi mọi phiên, bổ sung `sessionVersion` vào User/JWT ở một task bảo mật riêng.

## Sẽ chứa

- Xử lý OTP quên mật khẩu thật (model `PasswordResetOtp` đã có trong schema,
  `ForgotPasswordFlow.tsx` còn giả lập)
- `resetStudentPassword()` — admin reset mật khẩu tạm cho HS (không xem lại
  mật khẩu cũ, xem `src/lib/password.ts`)
- Trang "hoàn tất hồ sơ" cho tài khoản đăng ký qua Google (chưa có
  studentPhone/parentPhone lúc mới tạo — xem `callbacks.signIn` trong
  `src/auth.ts`)

**Liên quan:** `src/auth.ts` (cấu hình NextAuth trung tâm), `src/proxy.ts`
(gate route theo role/status), `prisma/schema.prisma` model `User`.
