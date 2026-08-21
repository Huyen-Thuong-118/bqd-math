# features/notifications

Gửi email (khi có đề mới) và SMS (cho phụ huynh) — 2 kênh thông báo riêng biệt.

**Sẽ chứa:**
- `email.ts` — dùng Resend, gửi link đề thi (yêu cầu mật khẩu GV cấp để mở)
- `sms.ts` — tích hợp SMS gateway (eSMS/SpeedSMS), có tính phí
- `types.ts`

**Liên quan:** `prisma/schema.prisma` model `Notification`.
