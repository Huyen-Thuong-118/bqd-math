import Link from "next/link";

/**
 * Sidebar quản trị — chỉ hiển thị trong /admin/**.
 * Tách riêng khỏi Navbar vì admin cần điều hướng dạng dashboard
 * (nhiều thao tác quản lý), không phải nav ngang cho người đọc.
 */
const ADMIN_LINKS = [
  { href: "/admin/lop-hoc", label: "Quản lý lớp học" },
  { href: "/admin/de-thi", label: "Quản lý đề thi" },
  { href: "/admin/hoc-sinh", label: "Quản lý học sinh" },
  { href: "/admin/lich-day", label: "Lịch dạy" },
];

export function AdminSidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-navy-100 bg-pastel-50 p-4">
      <p className="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-navy-300">
        Quản trị
      </p>
      <nav className="flex flex-col gap-1">
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg px-3 py-2 text-sm text-navy-500 hover:bg-pastel-200"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
