# features/home

Module "Trang chủ": phần giới thiệu (Hero) + khối **Lịch giảng dạy** hiển thị
lịch lớp Cơ bản / Nâng cao trong tuần.

Tách riêng thay vì nhét vào `features/classes` vì đây là UI **trang giới thiệu**
(marketing/landing), không dính tới nghiệp vụ quản lý lớp — HS/GV không thao
tác gì trên đó. `app/(public)/page.tsx` chỉ ráp 2 component lại, đúng nguyên
tắc "app/ chỉ lo routing" trong ARCHITECTURE.md.

**Đang có:**

- `types.ts` — `ClassSession`, `DaySchedule`, nhãn `LEVEL_LABEL` / `DAY_LABEL`.
  Field đặt trùng tên với model `TeachingSchedule` trong `prisma/schema.prisma`.
- `data.ts` — `scheduleMock` (**dữ liệu giả**, có TODO) + `groupByDay()` gom
  buổi học theo ngày, bỏ ngày trống, xếp Thứ 2 → Chủ nhật.
- `components/HeroSection.tsx` — quote truyền cảm hứng (**placeholder, có
  TODO**) + CTA cuộn xuống `#lich-giang-day`.
- `components/MathGlassVisual.tsx` — minh hoạ kim tự tháp kính, thuần SVG/CSS.
- `components/ScheduleSection.tsx` — lưới card lịch, animate so le khi cuộn tới.
- `components/DayScheduleCard.tsx` — 1 ngày = 1 card, badge Cơ bản / Nâng cao.

**Còn thiếu:**

- `queries.ts` — `getWeeklySchedule()` gọi `prisma.teachingSchedule.findMany()`
  để thay `scheduleMock`. Khi có, fetch trong `page.tsx` rồi truyền xuống
  `ScheduleSection` qua prop (bỏ import trực tiếp `weeklySchedule`).
- Model `TeachingSchedule` chưa có cột hình thức học (Trực tiếp / Online) —
  hiện `mode` mới chỉ tồn tại ở mock.

**Liên quan:** `prisma/schema.prisma` model `TeachingSchedule`, enum
`ClassLevel`; trang admin `app/admin/lich-day/page.tsx` (nơi GV sẽ CRUD lịch).
