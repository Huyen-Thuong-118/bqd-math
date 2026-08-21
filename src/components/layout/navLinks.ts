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
  { href: "/on-tap", label: "Câu hỏi ôn tập" },
  { href: "/thi-thu", label: "Phòng thi thử" },
  { href: "/tai-lieu", label: "Tài liệu" },
  { href: "/lien-he", label: "Liên hệ" },
];
