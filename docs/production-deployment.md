# Triển khai production BQD Math

Hệ thống production dùng Cloud Run, Cloud SQL PostgreSQL, Cloud Storage private,
Artifact Registry, Cloud Build, Secret Manager và Cloud Scheduler trong cùng
Google Cloud project. Gemini và dịch vụ gửi email vẫn là API riêng của tính năng.

Làm theo runbook đầy đủ tại
[`gcp-cloud-run-deployment.md`](./gcp-cloud-run-deployment.md).

## Nguyên tắc dữ liệu

- Cloud SQL bật backup và point-in-time recovery.
- PDF/tài liệu nằm trong bucket private; chỉ truy cập bằng signed URL ngắn hạn.
- Không tạo service-account JSON key. Cloud Run dùng service account được gắn trực tiếp.
- Không dùng database, bucket hoặc secret production cho preview/local.
- Không chạy `prisma migrate dev`, `seed:test-data` hay `SEED_DEMO_DATA` trên production.
- Backup trước migration lớn; rollback image không tự rollback database.

## Biến production

Runtime dùng:

- `CLOUD_SQL_CONNECTION_NAME`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `GCS_BUCKET_NAME`
- `AUTH_URL`, `NEXTAUTH_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `RESEND_API_KEY`, `EMAIL_FROM`
- `RESET_TOKEN_SECRET`, `CRON_SECRET`

Google Login và Cloudflare Stream là tùy chọn. `GOOGLE_CLIENT_ID` và
`GOOGLE_CLIENT_SECRET` phải được cấu hình cùng nhau.

## Smoke test trước khi mời học sinh

- ADMIN đăng nhập, đăng xuất, đổi/quên mật khẩu và nhận OTP thật.
- Học sinh đăng ký, ở trạng thái chờ, được duyệt rồi đăng nhập.
- Tạo nhiều lớp với 2–3 buổi/tuần; học sinh chỉ thấy lớp/lịch được duyệt.
- Đăng, ẩn và xóa thông báo; kiểm tra lại bên học sinh.
- Upload, xem và tải PDF sau một lần redeploy.
- Tạo/sửa đề, quét Gemini, làm bài, autosave, nộp và chấm điểm.
- Học sinh A không đọc được lớp, file, bài làm hoặc kết quả của B.
- Xem Cloud Run logs không có lỗi và thiết lập Billing budget/alert.
