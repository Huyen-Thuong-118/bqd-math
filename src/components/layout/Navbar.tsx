"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_LINKS } from "./navLinks";

/**
 * Thanh tác vụ đầu trang — hiển thị trên MỌI trang public + student.
 * Admin dùng AdminSidebar riêng (xem components/layout/AdminSidebar.tsx).
 *
 * Bố cục 3 vùng trong 1 thanh "pill" kính mờ nổi cách mép trên:
 *   trái = Đăng nhập · giữa = NAV_LINKS · phải = logo BQDMath (về "/")
 * Chia 3 cột `1fr auto 1fr` để cụm menu giữa luôn nằm chính giữa thanh,
 * không bị lệch khi chữ 2 bên dài ngắn khác nhau.
 *
 * Dưới lg: menu thu vào nút hamburger, chỉ còn hamburger + logo cho đỡ chật.
 */
export function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-4 z-50 mx-auto mt-4 w-full max-w-6xl px-4">
      <nav
        aria-label="Điều hướng chính"
        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-full border border-white/50 bg-pastel-50/70 px-3 py-2 shadow-[0_8px_32px_rgba(27,42,74,0.12)] backdrop-blur-xl lg:grid-cols-[1fr_auto_1fr] lg:px-4"
      >
        {/* TRÁI — Đăng nhập (desktop) / hamburger (mobile) */}
        <div className="flex items-center justify-start">
          {/* TODO: mở form đăng nhập / đổi thành Avatar học sinh khi có session,
              xem features/auth — để nguyên <button> vì route /dang-nhap chưa tồn tại */}
          <button
            type="button"
            className="hidden items-center gap-2 rounded-full border border-navy-200/60 bg-white/60 px-4 py-2 text-sm font-medium text-navy-500 transition-colors hover:bg-navy-500 hover:text-pastel-50 lg:inline-flex"
          >
            <LogIn className="size-4" aria-hidden />
            Đăng nhập
          </button>

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? "Đóng menu" : "Mở menu"}
            className="inline-flex size-10 items-center justify-center rounded-full border border-navy-200/60 bg-white/60 text-navy-500 transition-colors hover:bg-pastel-200 lg:hidden"
          >
            {isMenuOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>

        {/* GIỮA — toàn bộ mục menu (chỉ desktop) */}
        <ul className="hidden items-center gap-1 text-sm lg:flex">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "block rounded-full px-3 py-2 whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-navy-500 text-pastel-50"
                      : "text-navy-400 hover:bg-pastel-200 hover:text-navy-600",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* PHẢI — logo, bấm về Trang chủ */}
        <div className="flex items-center justify-end">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-navy-500 transition-opacity hover:opacity-70"
          >
            BQD<span className="text-navy-300">Math</span>
          </Link>
        </div>
      </nav>

      {/* Panel menu mobile — cùng công thức kính mờ với thanh pill */}
      <div
        id="mobile-menu"
        hidden={!isMenuOpen}
        className="mt-2 rounded-[2rem] border border-white/50 bg-pastel-50/90 p-3 shadow-[0_8px_32px_rgba(27,42,74,0.12)] backdrop-blur-xl lg:hidden"
      >
        <ul className="flex flex-col gap-1 text-sm">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  // Đóng menu ngay khi chọn mục, tránh panel còn mở đè lên trang mới
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "block rounded-2xl px-4 py-2.5 transition-colors",
                    isActive
                      ? "bg-navy-500 text-pastel-50"
                      : "text-navy-400 hover:bg-pastel-200 hover:text-navy-600",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li className="mt-1 border-t border-navy-100 pt-2">
            {/* TODO: nút Đăng nhập / Avatar học sinh, xem features/auth */}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 font-medium text-navy-500 hover:bg-pastel-200"
            >
              <LogIn className="size-4" aria-hidden />
              Đăng nhập
            </button>
          </li>
        </ul>
      </div>
    </header>
  );
}
