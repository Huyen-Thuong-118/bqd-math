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

Xem chi tiết logic tổ chức trong [`ARCHITECTURE.md`](./ARCHITECTURE.md).
Xem checklist bảo mật (bắt buộc đọc trước khi public) trong [`SECURITY.md`](./SECURITY.md).

```
src/
├── app/          # CHỈ routing + layout — không chứa business logic
├── features/     # Logic nghiệp vụ, chia theo domain (auth, classes, exams...)
├── components/   # UI dùng chung (ui/, layout/)
├── lib/          # Tiện ích kỹ thuật (db, auth config, helpers)
└── types/        # Type dùng chung toàn app
prisma/
└── schema.prisma # Toàn bộ data model
```

Mỗi thư mục trong `features/` có 1 file `README.md` ngắn giải thích phạm vi —
mở thư mục nào là biết ngay thư mục đó làm gì.

## Bắt đầu chạy project

### 1. Cài dependencies

```bash
npm install
```

### 2. Tạo file môi trường

```bash
cp .env.example .env
```

Cần điền các mục sau — xem chú thích chi tiết ngay trong `.env.example`:

- **`DATABASE_URL` + `DIRECT_URL`** — dùng [Neon](https://neon.tech) hoặc
  [Supabase](https://supabase.com) (miễn phí). **Bắt buộc dùng connection
  string qua pooler cho `DATABASE_URL`** (Neon: hostname có `-pooler`;
  Supabase: cổng `6543`) — nếu dùng nhầm direct connection, app sẽ bị lỗi
  cạn kết nối khi nhiều người dùng cùng lúc. `DIRECT_URL` chỉ Prisma CLI
  dùng khi migrate.
- **`R2_*`** — tạo bucket ở Cloudflare Dashboard → R2, tạo API token
- **`CLOUDFLARE_*`** — cần Cloudflare Workers Paid plan ($5/tháng) để dùng Stream

### 3. Khởi tạo database

```bash
npx prisma migrate dev --name init
```

Lệnh này tạo bảng trong DB theo `prisma/schema.prisma` + tự chạy
`prisma generate` (sinh Prisma Client có type an toàn).

#### Vì sao có `prisma.config.ts`?

Prisma 7 (bản đang dùng trong project) đổi cách cấu hình: không cho khai
báo connection string trong `schema.prisma` nữa. Giờ tách làm 2 nơi:

| File | Dùng khi nào | Đọc biến nào |
|------|-------------|--------------|
| `prisma.config.ts` (gốc repo) | Prisma CLI chạy (`migrate`, `studio`) | `DIRECT_URL` — không qua pooler, vì migrate cần chạy DDL trực tiếp |
| `src/lib/db.ts` | App chạy thật (mọi query trong code) | `DATABASE_URL` — qua pooler, qua driver adapter `@prisma/adapter-pg` |

Nếu quên điền 1 trong 2 biến ở `.env`, sẽ gặp lỗi rõ ràng ngay khi chạy
lệnh tương ứng — điền đủ cả 2 trước khi chạy bước 3.

### 4. Chạy dev server

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### Các lệnh hữu ích khác

| Lệnh | Mục đích |
|------|----------|
| `npm run db:studio` | Mở Prisma Studio — xem/sửa data trực quan như Excel |
| `npm run lint` | Kiểm tra lỗi code style |
| `npm run build` | Build production (kiểm tra lỗi trước khi deploy) |

## Bước tiếp theo (chưa làm trong lần setup này)

- [x] Connection pooling cho Prisma (`directUrl` trong schema + hướng dẫn `.env`)
- [x] Client lưu trữ R2 (`lib/storage.ts`) + Cloudflare Stream (`lib/stream.ts`)
- [x] Cơ chế batch-save đáp án chống nghẽn DB (`features/exams/hooks/useAnswerBuffer.ts`)
- [x] Mật khẩu hash 1 chiều, admin không xem lại được (`lib/password.ts`) — xem `SECURITY.md`
- [ ] **Ưu tiên cao:** thêm session check vào API route lưu đáp án (đang mở, ai biết attemptId cũng ghi được — xem SECURITY.md mục 3)
- [x] Cài & cấu hình NextAuth trong `src/auth.ts` — Credentials + Google, session JWT, gate route ở `src/proxy.ts`
- [ ] Chạy `npx shadcn@latest init` để thêm UI components vào `components/ui/`
- [ ] `PdfViewer.tsx` — render PDF qua signed URL, có watermark tên HS
- [ ] `AnswerSheet.tsx` + `ExamTimer.tsx` — ghép UI thật vào `useAnswerBuffer`
- [ ] Viết logic thật trong các `features/*/actions.ts` và `queries.ts` còn lại
- [ ] Load test 500 concurrent bằng k6 trước khi dùng thi thật
- [ ] Deploy lên [Vercel](https://vercel.com) — connect thẳng repo GitHub này

## Deploy

Khuyến nghị dùng **Vercel** (đội ngũ làm Next.js, miễn phí cho project nhỏ):

1. Vào [vercel.com](https://vercel.com) → New Project → import repo này
2. Điền các biến môi trường giống `.env` vào phần Environment Variables
3. Deploy — Vercel tự nhận diện Next.js, không cần config thêm
4. Sau đó gắn domain `bqdmath.edu.vn` trong Project Settings → Domains
