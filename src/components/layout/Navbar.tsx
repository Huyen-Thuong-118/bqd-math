"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogIn, LogOut, Menu, ShieldCheck, UserPlus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_LINKS } from "./navLinks";

/**
 * Thanh tác vụ đầu trang — hiển thị trên MỌI trang public + student.
 * Admin dùng AdminSidebar riêng (xem components/layout/AdminSidebar.tsx).
 *
 * Khung là 1 thanh ngang full-width dính mép trên, PHẲNG (không backdrop-blur,
 * không kính mờ) — nhường phần "kính" lại cho khối minh hoạ ở Hero. 2 góc trên
 * để vuông sát mép trình duyệt, chỉ bo 2 góc dưới nên thanh đọc như một cái
 * khay treo từ đầu trang xuống; bóng đổ nhẹ phía dưới để tách khỏi nội dung.
 *
 * `overflow-hidden` (chỉ dưới xl) là BẮT BUỘC, không phải cho đẹp: panel menu
 * mobile nằm trong header và cùng màu nền, không cắt thì 2 góc vuông của nó
 * thò ra ngoài đường bo khi menu đang mở. Bóng đổ vẽ ngoài border-box nên
 * không bị cắt. Từ xl trở lên phải TRẢ LẠI overflow-visible: panel mobile đã
 * `xl:hidden` (hết cần clip) và dropdown tài khoản (AccountMenu, absolute)
 * lại trồi xuống dưới mép header — overflow-hidden ở xl sẽ cắt cụt nó, dropdown
 * mở ra trông như "rỗng" dù item vẫn render đúng trong DOM.
 *
 * Bố cục 3 vùng: trái = logo BQDMath (về "/") · giữa = NAV_LINKS ·
 * phải = cụm Đăng nhập/Đăng ký tách riêng bằng 1 vạch ngăn mảnh.
 * Chia 3 cột `1fr auto 1fr` để cụm menu giữa luôn nằm chính giữa thanh,
 * không bị lệch khi logo và cụm nút 2 bên rộng khác nhau.
 *
 * KHÔNG bọc `max-w-6xl` như <main>: nội dung nav chạy hết bề ngang để cụm
 * Đăng nhập/Đăng ký nằm sát mép phải màn hình. Đổi lại logo cũng ra sát mép
 * trái, không còn thẳng hàng với nội dung trang — đánh đổi có chủ ý.
 *
 * Nền `bg-nav` (#f0f3fa, xem globals.css): xám-xanh nhạt hơi lệch tông khỏi
 * nền trang pastel-100 nên thanh vẫn tách ra dù phẳng và không viền dày.
 *
 * Dưới xl: menu thu vào nút hamburger, chỉ còn logo + hamburger cho đỡ chật —
 * ở cỡ chữ này 6 mục menu + 2 nút không đủ chỗ trên 1 hàng.
 */
export function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && session?.user;

  return (
    <header className="sticky top-0 z-50 w-full overflow-hidden rounded-b-[2.25rem] bg-nav shadow-[0_10px_28px_rgba(27,42,74,0.12)] xl:overflow-visible">
      <nav
        aria-label="Điều hướng chính"
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 xl:grid-cols-[1fr_auto_1fr] xl:px-5"
      >
        {/* TRÁI — logo, bấm về Trang chủ */}
        <div className="flex items-center justify-start">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight whitespace-nowrap text-navy-500 transition-opacity hover:opacity-70"
          >
            BQD<span className="text-navy-300">Math</span>
          </Link>
        </div>

        {/* GIỮA — toàn bộ mục menu (chỉ desktop) */}
        <ul className="hidden items-center gap-0.5 text-lg xl:flex">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "block rounded-full px-2.5 py-2 whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-navy-500 text-pastel-50"
                      : "text-navy-500 hover:bg-white hover:text-navy-600",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* PHẢI — cụm tài khoản, tách khỏi menu bằng vạch ngăn để đọc như 1
            khối riêng. Đăng ký là nút chính (nền navy đặc), Đăng nhập là phụ.
            Hamburger thay cả cụm này ở mobile. */}
        <div className="flex items-center justify-end gap-2 xl:border-l xl:border-navy-100/80 xl:pl-3">
          {isAuthenticated ? (
            <div className="hidden xl:block">
              <AccountMenu user={session.user} />
            </div>
          ) : (
            <>
              <Link
                href="/dang-nhap"
                className="hidden items-center gap-2 rounded-full border border-navy-200/60 bg-white px-5 py-2.5 text-lg font-medium whitespace-nowrap text-navy-500 transition-colors hover:bg-pastel-50 xl:inline-flex"
              >
                <LogIn className="size-5" aria-hidden />
                Đăng nhập
              </Link>

              <Link
                href="/dang-ky"
                className="hidden items-center gap-2 rounded-full bg-navy-500 px-5 py-2.5 text-lg font-semibold whitespace-nowrap text-pastel-50 transition-colors hover:bg-navy-600 xl:inline-flex"
              >
                <UserPlus className="size-5" aria-hidden />
                Đăng ký
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? "Đóng menu" : "Mở menu"}
            className="inline-flex size-11 items-center justify-center rounded-full border border-navy-200/60 bg-white text-navy-500 transition-colors hover:bg-pastel-50 xl:hidden"
          >
            {isMenuOpen ? (
              <X className="size-6" aria-hidden />
            ) : (
              <Menu className="size-6" aria-hidden />
            )}
          </button>
        </div>
      </nav>

      {/* Panel menu mobile — cũng phẳng, chạy hết bề ngang như thanh nav */}
      <div
        id="mobile-menu"
        hidden={!isMenuOpen}
        className="border-t border-navy-100/70 bg-nav xl:hidden"
      >
        <ul className="flex w-full flex-col gap-1 px-4 py-4 text-lg">
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
                    "block rounded-2xl px-4 py-3 transition-colors",
                    isActive
                      ? "bg-navy-500 text-pastel-50"
                      : "text-navy-500 hover:bg-white hover:text-navy-600",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li className="mt-1 flex flex-col gap-2 border-t border-navy-100 pt-2">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2.5 px-2 py-1.5">
                  <Avatar user={session.user} />
                  <span className="truncate font-medium text-navy-500">
                    {session.user.name ?? session.user.email}
                  </span>
                </div>
                {session.user.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-navy-200/60 bg-white px-4 py-3 font-medium text-navy-500 transition-colors hover:bg-pastel-50"
                  >
                    <ShieldCheck className="size-5" aria-hidden />
                    Trang quản trị
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-navy-500 px-4 py-3 font-semibold text-pastel-50 transition-colors hover:bg-navy-600"
                >
                  <LogOut className="size-5" aria-hidden />
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/dang-nhap"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-navy-200/60 bg-white px-4 py-3 font-medium text-navy-500 transition-colors hover:bg-pastel-50"
                >
                  <LogIn className="size-5" aria-hidden />
                  Đăng nhập
                </Link>
                <Link
                  href="/dang-ky"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-navy-500 px-4 py-3 font-semibold text-pastel-50 transition-colors hover:bg-navy-600"
                >
                  <UserPlus className="size-5" aria-hidden />
                  Đăng ký
                </Link>
              </>
            )}
          </li>
        </ul>
      </div>
    </header>
  );
}

type NavbarSessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: string;
};

function getInitial(user: NavbarSessionUser): string {
  const source = user.name ?? user.email ?? "?";
  return source.trim().charAt(0).toUpperCase() || "?";
}

/** Ảnh Google trả về là URL ngoài (lh3.googleusercontent.com) — chưa cấu hình
 * next.config images.remotePatterns nên dùng thẳng <img>, không phải next/image
 * (thêm remotePatterns là sửa next.config, ngoài phạm vi mục 8). */
function Avatar({ user }: { user: NavbarSessionUser }) {
  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt=""
        className="size-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-500 text-sm font-semibold text-pastel-50">
      {getInitial(user)}
    </span>
  );
}

/**
 * Danh sách CỐ ĐỊNH — luôn 2 phần tử, KHÔNG được filter trước khi map (dễ vô
 * tình làm rỗng cả mảng nếu điều kiện lọc sai). Ẩn/hiện từng dòng xử lý riêng
 * bên trong .map(), "adminOnly" chỉ tắt đúng 1 dòng "Trang quản trị".
 */
const ACCOUNT_MENU_ITEMS = [
  { key: "admin", label: "Trang quản trị", icon: ShieldCheck, href: "/admin", adminOnly: true },
  { key: "logout", label: "Đăng xuất", icon: LogOut, href: null, adminOnly: false },
] as const;

/** Dropdown tài khoản desktop — đóng khi bấm ra ngoài, nhấn Esc, hoặc chọn 1 item. */
function AccountMenu({ user }: { user: NavbarSessionUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function closeAndSignOut() {
    setIsOpen(false);
    signOut();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-navy-200/60 bg-white py-1.5 pr-4 pl-1.5 text-lg font-medium whitespace-nowrap text-navy-500 transition-colors hover:bg-pastel-50"
      >
        <Avatar user={user} />
        <span className="max-w-32 truncate">{user.name ?? user.email}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-navy-100 bg-white py-1.5 shadow-lg"
        >
          {ACCOUNT_MENU_ITEMS.map((item) => {
            if (item.adminOnly && user.role !== "ADMIN") return null;
            const Icon = item.icon;

            if (item.href) {
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-navy-600 transition-colors hover:bg-pastel-50"
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={closeAndSignOut}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-navy-600 transition-colors hover:bg-pastel-50"
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
