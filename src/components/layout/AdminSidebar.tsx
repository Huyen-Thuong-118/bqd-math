"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  FileQuestionMark,
  Folder,
  GraduationCap,
  House,
  KeyRound,
  LayoutDashboard,
  Menu,
  Search,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

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
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/tim-kiem", label: "Tìm kiếm", icon: Search },
    ],
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
    items: [
      { href: "/admin/hoc-sinh", label: "Học sinh", icon: Users },
      { href: "/tai-khoan/doi-mat-khau", label: "Đổi mật khẩu", icon: KeyRound },
    ],
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
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("a, button, select")?.focus());
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("a, button, select, input")].filter((item) => !item.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 flex min-h-16 items-center justify-between border-b border-navy-100 bg-pastel-50 px-4 md:hidden">
        <Link href="/admin" className="font-semibold text-navy-600">BQD Math · Quản trị</Link>
        <button ref={triggerRef} type="button" aria-expanded={open} aria-controls="admin-mobile-menu" aria-label={open ? "Đóng menu quản trị" : "Mở menu quản trị"} onClick={() => setOpen((current) => !current)} className="flex size-11 items-center justify-center rounded-xl border border-navy-100 bg-white text-navy-500">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {open && <div id="admin-mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-40 bg-navy-900/45 md:hidden" onClick={() => setOpen(false)}><aside ref={panelRef} aria-label="Menu quản trị" className="h-full w-[min(20rem,88vw)] overflow-y-auto border-r border-navy-100 bg-pastel-50 p-4" onClick={(event) => event.stopPropagation()}><SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} /></aside></div>}
      <aside className="hidden w-60 shrink-0 border-r border-navy-100 bg-pastel-50 p-4 md:block">
        <SidebarContent pathname={pathname} />
      </aside>
    </>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <p className="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-navy-300">Quản trị</p>
      <ThemeToggle className="mb-3 w-full" />
      <Link href="/" onClick={onNavigate} className="mb-5 flex min-h-11 items-center gap-2.5 rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm font-semibold text-navy-600 shadow-sm transition hover:bg-pastel-100">
        <House className="size-4 shrink-0" aria-hidden />Trang chủ BQD Math
      </Link>
      <nav className="flex flex-col gap-4">
        {ADMIN_GROUPS.map((group) => <div key={group.title}><p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-navy-300">{group.title}</p><div className="flex flex-col gap-1">{group.items.map((item) => {
          const active = isActiveHref(pathname, item.href);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-2.5 rounded-lg border-l-4 border-transparent px-2.5 py-2 text-sm transition-colors", active ? "border-navy-500 bg-pastel-200 font-semibold text-navy-600" : "text-navy-500 hover:bg-pastel-200/60")}><Icon className="size-4 shrink-0" aria-hidden />{item.label}</Link>;
        })}</div></div>)}
      </nav>
    </>
  );
}
