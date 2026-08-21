# components/

UI dùng chung, **không chứa business logic** (không gọi DB, không gọi API trực tiếp).

- `ui/` — các thành phần cơ bản tái sử dụng (Button, Input, Dialog...) theo
  chuẩn shadcn/ui. Chạy `npx shadcn@latest add button` để thêm.
- `layout/` — `Navbar.tsx`, `Footer.tsx`, `AdminSidebar.tsx` — khung sườn trang.

Nếu 1 component cần logic riêng cho 1 module (vd: `ExamTimer` chỉ dùng
trong đề thi) → đặt trong `features/<module>/components/`, KHÔNG đặt ở đây.
