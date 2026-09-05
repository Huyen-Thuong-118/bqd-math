# Triển khai production BQD Math

Tài liệu này dành cho hệ thống chạy thật với học sinh thật. Không dùng SQLite,
PostgreSQL local, filesystem của Vercel, email thử nghiệm hoặc tài khoản dùng
chung.

## 1. Kiến trúc bắt buộc

- Vercel Pro: chạy ứng dụng Next.js, HTTPS, cron và firewall.
- Neon PostgreSQL gói có backup/PITR phù hợp: lưu tài khoản, lớp, lịch, đề và kết quả.
- Cloudflare R2 private bucket: lưu PDF. Trình duyệt upload trực tiếp bằng URL ký ngắn hạn.
- Gemini API: đọc cấu trúc PDF và đáp án. OCR local không tồn tại trên Vercel.
- Resend với domain gửi thư đã xác minh: gửi OTP quên mật khẩu.
- Domain chính thức, ví dụ `bqdmath.vn`; không dùng URL preview làm URL đăng nhập production.

Ứng dụng hiện phục vụ một đơn vị với một vai trò ADMIN toàn quyền. Nếu nhiều
trung tâm/giáo viên độc lập cùng mua và phải tách dữ liệu, cần làm multi-tenant
trước; không cấp chung tài khoản ADMIN của hệ thống này.

## 2. Database

1. Tạo project Neon ở region gần người dùng (ưu tiên Singapore nếu tài khoản hỗ trợ).
2. Tạo database production riêng và bật phương án backup/PITR phù hợp.
3. Lấy hai connection string:
   - `DATABASE_URL`: pooled connection, hostname Neon thường có `-pooler`.
   - `DIRECT_URL`: direct/unpooled connection, chỉ dùng cho Prisma migration.
4. Cả hai URL phải dùng TLS (`sslmode=require`).
5. Preview deployment phải dùng Neon branch/database riêng, tuyệt đối không dùng
   chung database production.

Sau khi kéo biến môi trường production về file local được gitignore, chạy:

```bash
DOTENV_CONFIG_PATH=.vercel/.env.production.local npm run check:production-env
DOTENV_CONFIG_PATH=.vercel/.env.production.local npm run db:migrate:deploy
```

Không dùng `prisma migrate dev` trên production. Backup trước migration lớn và
triển khai schema theo hướng tương thích ngược; rollback code không tự rollback DB.

## 3. Cloudflare R2

1. Tạo private bucket riêng cho production.
2. Tạo API token chỉ có Object Read & Write trên đúng bucket đó.
3. Không bật public bucket và không điền `R2_PUBLIC_URL`.
4. Cấu hình CORS, thay domain trong ví dụ bằng domain thật:

```json
[
  {
    "AllowedOrigins": ["https://bqdmath.vn"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Không cấp quyền quản trị tài khoản Cloudflare cho ứng dụng. Chỉ dùng token giới
hạn bucket và xoay token ngay nếu nghi ngờ lộ.

## 4. Biến môi trường Vercel Production

Đánh dấu Sensitive cho mọi password, connection string, API key và secret.

### Bắt buộc

- `DATABASE_URL`, `DIRECT_URL`
- `AUTH_URL` và `NEXTAUTH_URL`: cùng trỏ tới domain HTTPS chính thức
- `AUTH_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 byte
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `RESEND_API_KEY`, `EMAIL_FROM`
- `RESET_TOKEN_SECRET`, `CRON_SECRET`: hai secret ngẫu nhiên khác nhau

### Tùy chọn

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: phải cấu hình cùng nhau; redirect
  URI là `https://<domain>/api/auth/callback/google`.
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`: khi dùng video Stream.
- `SMS_API_KEY`, `SMS_BRAND_NAME`: khi bật SMS.
- `OCR_SERVICE_URL`: chỉ điền nếu có một OCR service HTTPS thật; không dùng
  `localhost`/`127.0.0.1` trên production.

Không bật `SEED_DEMO_DATA`. Không đưa `SEED_ADMIN_PASSWORD` vào runtime production.

## 5. Tạo ADMIN đầu tiên

Tạo file local riêng (đã nằm trong pattern `.env*` của `.gitignore`) chứa URL DB
production và ba biến `SEED_ADMIN_*`. Dùng email thật, số điện thoại thật và mật
khẩu mạnh, sau đó chạy một lần:

```bash
DOTENV_CONFIG_PATH=.env.seed.production.local npm run seed
```

Xóa file seed local sau khi đăng nhập thành công. Học sinh tự đăng ký ở trạng
thái PENDING; ADMIN duyệt rồi thêm vào lớp. Không chạy `seed:test-data` trên DB thật.

## 6. Tạo project và deploy

1. Import GitHub repository vào Vercel team Pro.
2. Framework Preset: Next.js; Root Directory là repository root.
3. Khai báo riêng Environment Variables cho Production và Preview.
4. Gắn domain, xác minh DNS, rồi cập nhật `AUTH_URL`, `NEXTAUTH_URL`, Resend và R2 CORS.
5. Chạy `npm run check:production-env`, migration và seed ADMIN như trên.
6. Deploy commit đã qua `npm run lint && npm run build`.
7. Bật Spend Management, cảnh báo usage và firewall/rate limit cho đăng nhập,
   đăng ký và quên mật khẩu.

## 7. Smoke test bắt buộc trước khi mời học sinh

- ADMIN đăng nhập, đăng xuất, đổi mật khẩu và quên mật khẩu nhận OTP thật.
- Học sinh đăng ký, bị chặn khi PENDING, được duyệt rồi đăng nhập.
- Tạo lớp 2-3 buổi/tuần; học sinh chỉ thấy lớp và lịch đã được duyệt.
- Đăng, ẩn và xóa thông báo; kiểm tra phía học sinh sau mỗi thao tác.
- Upload tài liệu và cặp PDF đề/đáp án gần 20 MB; xem được sau một lần redeploy.
- Tạo đề, quét Gemini, làm bài, autosave, nộp bài, chấm điểm và tải CSV.
- Tài khoản học sinh A không truy cập được lớp, file, attempt hoặc kết quả của B.
- Cron cleanup trả 401 khi thiếu secret và chạy thành công từ Vercel Cron.

Chỉ mở public sau khi có Privacy Policy, điều khoản sử dụng, quy trình yêu cầu
xóa dữ liệu và cơ chế đồng ý phù hợp cho dữ liệu học sinh/trẻ vị thành niên.

