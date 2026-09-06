# BQD Math

Hệ thống ôn luyện & thi thử Toán học — quản lý lớp học, đề thi, câu hỏi ôn
tập theo chương, phòng thi thử có chấm điểm.

🔗 Domain dự kiến: `bqdmath.edu.vn`

## Tech stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind CSS v4** — theme màu Navy/Pastel, cấu hình bằng CSS (`src/app/globals.css`)
- **Prisma + PostgreSQL** — database
- **NextAuth (Auth.js v5)** — đăng nhập Credentials + Google, phân quyền Admin/Student (`src/auth.ts`)
- Font: **Comfortaa**

## Cấu trúc thư mục

Xem chi tiết logic tổ chức trong [`docs/architecture.md`](./docs/architecture.md).
Xem phạm vi sản phẩm và roadmap trong
[`docs/product-blueprint.md`](./docs/product-blueprint.md).
Backlog implementation có thể giao theo từng task cho agent nằm tại
[`docs/implementation-agent-backlog.md`](./docs/implementation-agent-backlog.md).
Xem phần đã triển khai cho lát cắt 0 trong
[`docs/implementation-slice-0.md`](./docs/implementation-slice-0.md).
Luồng làm bài end-to-end nằm tại
[`docs/implementation-slice-1.md`](./docs/implementation-slice-1.md).
Upload PDF và phiếu tô nằm tại
[`docs/implementation-slice-2.md`](./docs/implementation-slice-2.md).
Xem checklist bảo mật trong [`docs/security.md`](./docs/security.md) trước khi public.
Deploy production lên Google Cloud Run theo
[`docs/gcp-cloud-run-deployment.md`](./docs/gcp-cloud-run-deployment.md).

```
src/
├── app/          # CHỈ routing + layout — không chứa business logic
├── features/     # Logic nghiệp vụ, chia theo domain (auth, classes, exams...)
├── components/   # UI dùng chung (ui/, layout/)
├── lib/          # Tiện ích kỹ thuật (db, auth config, helpers)
└── types/        # Type dùng chung toàn app
docs/              # Kiến trúc, bảo mật và tài liệu kỹ thuật
infra/             # Dịch vụ local (Docker Compose)
prisma/            # Schema, migration và seed database
public/            # File tĩnh
```

Mỗi thư mục trong `features/` có 1 file `README.md` ngắn giải thích phạm vi —
mở thư mục nào là biết ngay thư mục đó làm gì.

## Bắt đầu chạy project

### Chạy nhanh local

Sau khi mở Docker Desktop, chạy một lệnh để tự tạo `.env` (nếu chưa có),
cài dependencies, khởi động PostgreSQL + OCR, áp dụng migration và chạy app:

```bash
npm run local
```

Mở [http://localhost:3000](http://localhost:3000). Nhấn `Ctrl+C` để dừng
dev server; PostgreSQL và OCR tiếp tục chạy để lần khởi động sau nhanh hơn.

Lệnh này luôn dùng PostgreSQL Docker và `storage/uploads/` trên máy hiện tại,
kể cả khi `.env` có cấu hình GCP. Vì vậy thao tác thử nghiệm local không sửa
Cloud SQL hoặc file trên Cloud Storage production.

### Dùng Vertex AI khi chạy local (tùy chọn)

Vertex AI chạy được ở local bằng Application Default Credentials (ADC), không
cần tạo hoặc tải service-account JSON key. Sau khi cài Google Cloud CLI, chạy:

```bash
npm run setup:local:vertex
npm run local
```

Tài khoản Google đang đăng nhập phải có role `Vertex AI User`
(`roles/aiplatform.user`) trên project `bqd-math-507809`, và project phải được
liên kết với một tài khoản Cloud Billing đang hoạt động. Nếu chưa cấu hình ADC,
chưa bật billing hoặc Vertex AI tạm lỗi, tính năng quét đề sẽ fallback sang OCR
local.

### Dữ liệu sau khi deploy GCP

Cloud Run chỉ chạy container ứng dụng. Dữ liệu nghiệp vụ nằm trong Cloud SQL,
còn PDF/tài liệu nằm trong Cloud Storage, nên các lần deploy sau vẫn giữ nguyên
dữ liệu. Pipeline production chỉ chạy migration rồi thay revision Cloud Run;
không reset database và không xóa bucket.

Local và production cố ý dùng hai bộ dữ liệu riêng. Không nên trỏ máy local
vào database/bucket production vì seed, migration thử nghiệm hoặc thao tác trên
UI local có thể thay đổi dữ liệu thật. Khi cần môi trường online dùng chung để
kiểm thử, hãy tạo Cloud SQL database và bucket staging riêng.

### 1. Tạo file môi trường

```bash
cp .env.example .env
```

Prisma đọc `DIRECT_URL` ngay trong bước `postinstall`, vì vậy cần tạo và điền
`.env` trước khi cài dependencies.

### 2. Chọn database

#### Phát triển độc lập bằng Docker (khuyến nghị cho local)

Repo có sẵn PostgreSQL 16 trong `infra/docker-compose.yml`. Dùng script npm
để không phải nhớ đường dẫn file hạ tầng:

```bash
npm run db:up
```

Với local, dùng cùng một URL cho cả app và Prisma CLI:

```env
DATABASE_URL="postgresql://bqdmath:bqdmath_dev@127.0.0.1:5432/bqdmath"
DIRECT_URL="postgresql://bqdmath:bqdmath_dev@127.0.0.1:5432/bqdmath"
```

Database và volume này chỉ nằm trên máy hiện tại; cổng PostgreSQL chỉ bind
vào `127.0.0.1`, không mở ra LAN/Internet.

Lệnh này cũng khởi động OCR local ở `127.0.0.1:8001` (PyMuPDF + Tesseract
`vie+eng`). Không cần API key; dữ liệu PDF không rời máy.

#### Production trên Google Cloud

Production dùng Cloud Run + Cloud SQL + Cloud Storage. Cloud Run truy cập bằng
service account nên không cần JSON key. Xem
[`docs/gcp-cloud-run-deployment.md`](./docs/gcp-cloud-run-deployment.md).

### 3. Cài dependencies

```bash
npm install
```

### 4. Khởi tạo database

```bash
npm run db:migrate
```

Lệnh này tạo bảng trong DB theo `prisma/schema.prisma` + tự chạy
`prisma generate` (sinh Prisma Client có type an toàn).

#### Vì sao có `prisma.config.ts`?

Prisma 7 (bản đang dùng trong project) đổi cách cấu hình: không cho khai
báo connection string trong `schema.prisma` nữa. Giờ tách làm 2 nơi:

| File | Dùng khi nào | Đọc biến nào |
|------|-------------|--------------|
| `prisma.config.ts` (gốc repo) | Prisma CLI chạy (`migrate`, `studio`) | Local dùng `DIRECT_URL`; Cloud Build dùng Cloud SQL Auth Proxy |
| `src/lib/db.ts` | App chạy thật (mọi query trong code) | Local dùng `DATABASE_URL`; Cloud Run dùng Unix socket Cloud SQL |

Nếu quên điền 1 trong 2 biến ở `.env`, sẽ gặp lỗi rõ ràng ngay khi chạy
lệnh tương ứng — điền đủ cả 2 trước khi chạy bước 3.

### 5. Tạo tài khoản admin local (tuỳ chọn)

Điền `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD` trong
`.env`, sau đó chạy:

```bash
npm run seed
```

### 6. Chạy dev server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### 7. Bật đăng nhập Google (tuỳ chọn)

Tạo Google OAuth Client loại **Web application**, thêm origin
`http://localhost:3000` và redirect URI
`http://localhost:3000/api/auth/callback/google`, rồi điền
`GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` trong `.env`. Khởi động lại dev
server sau khi đổi biến môi trường. Xem đầy đủ luồng và checklist kiểm thử tại
[`docs/implementation-slice-0.md`](./docs/implementation-slice-0.md).

### Các lệnh hữu ích khác

| Lệnh | Mục đích |
|------|----------|
| `npm run db:studio` | Mở Prisma Studio — xem/sửa data trực quan như Excel |
| `npm run lint` | Kiểm tra lỗi code style |
| `npm run build` | Build production (kiểm tra lỗi trước khi deploy) |
| `npm run verify:slice-0` | Kiểm tra tự động auth/trạng thái trên DB local (cần dev server) |
| `npm run verify:slice-1` | Kiểm tra ownership, autosave, chấm điểm và kết quả (cần seed + dev server) |
| `npm run verify:slice-2` | Kiểm tra quyền PDF, download và lời giải (cần dev server) |
| `npm run verify:change-password` | Kiểm tra đổi mật khẩu cũ/mới và chặn tài khoản bị khóa |
| `npm run verify:backlog` | Kiểm tra filter, mã quản lý, metric tiến độ và invariant dữ liệu mới |
| `npm run seed:samples` | Import cặp PDF số 1 trong `data/` thành đề mẫu 12–4–6 |

## Bước tiếp theo (chưa làm trong lần setup này)

- [x] Connection pooling cho Prisma (`directUrl` trong schema + hướng dẫn `.env`)
- [x] Client lưu trữ Cloud Storage (`lib/storage.ts`) + Cloudflare Stream tùy chọn (`lib/stream.ts`)
- [x] Cơ chế batch-save đáp án chống nghẽn DB (`features/exams/hooks/useAnswerBuffer.ts`)
- [x] Mật khẩu hash 1 chiều, admin không xem lại được (`lib/password.ts`) — xem `docs/security.md`
- [x] Session + ownership + deadline cho API route autosave đáp án
- [x] Cài & cấu hình NextAuth trong `src/auth.ts` — Credentials + Google, session JWT, gate route ở `src/proxy.ts`
- [ ] Chạy `npx shadcn@latest init` để thêm UI components vào `components/ui/`
- [x] `PdfViewer.tsx` — render PDF canvas qua API có kiểm tra quyền, zoom và watermark
- [x] UI làm 10 câu + `ExamTimer` + autosave/reload + nộp/chấm/kết quả
- [ ] Viết logic thật trong các `features/*/actions.ts` và `queries.ts` còn lại
- [ ] Load test 500 concurrent bằng k6 trước khi dùng thi thật
- [x] Chuẩn bị Docker/Cloud Build để deploy lên Google Cloud Run

## Deploy production

Không deploy bản dùng thật chỉ bằng cách import repo rồi bấm Deploy. Production
cần Cloud SQL có backup, Cloud Storage private, email domain thật, secret riêng, migration
và smoke test hai vai trò. Làm theo runbook đầy đủ tại
[`docs/production-deployment.md`](./docs/production-deployment.md).
Các bước tạo GCP project, Secret Manager, migration, deploy và scheduler nằm tại
[`docs/gcp-cloud-run-deployment.md`](./docs/gcp-cloud-run-deployment.md).
