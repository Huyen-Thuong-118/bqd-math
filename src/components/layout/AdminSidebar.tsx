"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileQuestionMark,
  Folder,
  GraduationCap,
  House,
  LayoutDashboard,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Sidebar quản trị — chỉ hiển thị trong /admin/**.
 * Tách riêng khỏi Navbar vì admin cần điều hướng dạng dashboard
 * (nhiều thao tác quản lý), không phải nav ngang cho người đọc.
 *
 * "use client" vì cần usePathname() để tô sáng mục đang mở — cùng cách
 * Navbar.tsx đang làm cho menu ngang.
 *
 * Chia nhóm có tiêu đề để 7 mục không còn đọc như 1 danh sách phẳng — nhóm
 * theo luồng công việc thật của admin (vận hành lớp học khác với ngân hàng
 * nội dung khác với quản lý tài khoản), không theo thứ tự bảng chữ cái.
 */
const ADMIN_GROUPS = [
  {
    title: "Tổng quan",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Vận hành lớp học",
    items: [
      { href: "/admin/lop-hoc", label: "Lớp học & lịch dạy", icon: GraduationCap },
    ],
  },
  {
    title: "Ngân hàng nội dung",
    items: [
      { href: "/admin/de-thi", label: "Đề thi thử", icon: FileQuestionMark },
      { href: "/admin/cau-hoi-on-tap", label: "Câu hỏi ôn tập", icon: BookOpen },
      { href: "/admin/tai-lieu", label: "Tài liệu", icon: Folder },
    ],
  },
  {
    title: "Tài khoản",
    items: [{ href: "/admin/hoc-sinh", label: "Học sinh", icon: Users }],
  },
] as const;

/** "/admin" phải so khớp TUYỆT ĐỐI — dùng startsWith thì Dashboard sẽ sáng
 * ở MỌI trang admin (mọi route con đều bắt đầu bằng "/admin"). Các mục còn
 * lại so khớp cả path con (vd /admin/de-thi/tao-moi vẫn làm sáng "Đề thi thử"). */
function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-navy-100 bg-pastel-50 p-4">
      <p className="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-navy-300">
        Quản trị
      </p>
      <Link
        href="/"
        className="mb-5 flex items-center gap-2.5 rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm font-semibold text-navy-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-pastel-100"
      >
        <House className="size-4 shrink-0" aria-hidden />
        Trang chủ BQD Math
      </Link>
      <nav className="flex flex-col gap-4">
        {ADMIN_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-navy-300">
              {group.title}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const isActive = isActiveHref(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      // border-l-4 border-transparent LUÔN có mặt (kể cả khi
                      // không active) — chỉ đổi màu border khi active thay vì
                      // thêm/bớt border, tránh chữ bị đẩy ngang 4px mỗi lần
                      // đổi trang.
                      "flex items-center gap-2.5 rounded-lg border-l-4 border-transparent px-2.5 py-2 text-sm transition-colors",
                      isActive
                        ? "border-navy-500 bg-pastel-200 font-semibold text-navy-600"
                        : "text-navy-500 hover:bg-pastel-200/60",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
