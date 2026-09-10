/**
 * Nguồn duy nhất của danh sách mục điều hướng — dùng chung cho Navbar
 * (thanh trên cùng) và Footer (cột "Liên kết nhanh").
 *
 * Tách khỏi Navbar.tsx vì Navbar là client component (có menu mobile),
 * còn Footer là server component — cả hai chỉ cần dữ liệu, không cần
 * kéo theo bundle của nhau.
 *
 * Danh sách lấy từ spec: Trang chủ, Lớp học, Câu hỏi ôn tập,
 * Phòng thi thử, Tài liệu, Liên hệ.
 */
export type NavLink = {
  href: string;
  label: string;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Trang chủ" },
  { href: "/lop-hoc", label: "Lớp học" },
  { href: "/lich-hoc", label: "Lịch học" },
  { href: "/on-tap", label: "Câu hỏi ôn tập" },
  { href: "/thi-thu", label: "Phòng thi thử" },
  { href: "/tai-lieu", label: "Tài liệu" },
  { href: "/lien-he", label: "Liên hệ" },
];

/** Điều hướng tương ứng cho tài khoản giáo viên khi đang ở trang public.
 * Mỗi mục đi thẳng vào đúng màn hình quản trị, tránh mở nhầm giao diện học sinh. */
export const ADMIN_NAV_LINKS: NavLink[] = [
  { href: "/admin", label: "Trang chủ" },
  { href: "/admin/lop-hoc#quan-ly-lop", label: "Lớp học" },
  { href: "/admin/lop-hoc#lich-day", label: "Lịch học" },
  { href: "/admin/cau-hoi-on-tap", label: "Câu hỏi ôn tập" },
  { href: "/admin/de-thi", label: "Phòng thi thử" },
  { href: "/admin/tai-lieu", label: "Tài liệu" },
  { href: "/lien-he", label: "Liên hệ" },
];
