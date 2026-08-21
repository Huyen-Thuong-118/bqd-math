import Link from "next/link";

/**
 * Thanh tác vụ đầu trang — hiển thị trên MỌI trang public + student.
 * Admin dùng AdminSidebar riêng (xem components/layout/AdminSidebar.tsx).
 *
 * Danh sách mục lấy từ spec: Trang chủ, Lớp học, Câu hỏi ôn tập,
 * Phòng thi thử, Tài liệu, Liên hệ.
 */
const NAV_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/lop-hoc", label: "Lớp học" },
  { href: "/on-tap", label: "Câu hỏi ôn tập" },
  { href: "/thi-thu", label: "Phòng thi thử" },
  { href: "/tai-lieu", label: "Tài liệu" },
  { href: "/lien-he", label: "Liên hệ" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-navy-100 bg-pastel-50/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-navy-500">
          BQD Math
        </Link>
        <ul className="flex flex-wrap items-center gap-1 text-sm">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-full px-3 py-1.5 text-navy-400 transition-colors hover:bg-pastel-200 hover:text-navy-600"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        {/* TODO: nút Đăng nhập / Avatar học sinh, xem features/auth */}
      </nav>
    </header>
  );
}
