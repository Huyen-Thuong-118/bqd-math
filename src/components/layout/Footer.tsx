import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { NAV_LINKS } from "./navLinks";

/** lucide-react v1 đã bỏ icon thương hiệu — vẽ tay chữ "f" cho gọn,
 *  khỏi thêm 1 package chỉ để lấy 1 icon. */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.5-1.5H16.7V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2V10H7.5v3h2.7v8h3.3Z" />
    </svg>
  );
}

/**
 * Footer — thông tin liên hệ hiển thị cuối MỌI trang.
 *
 * Dữ liệu thật (địa chỉ, sđt, link fb) sẽ lấy từ bảng ContactInfo
 * (prisma/schema.prisma) qua features/notifications hoặc 1 bảng settings
 * riêng — hiện để placeholder, gom hết vào 1 object ngay dưới đây để
 * sau này chỉ phải sửa đúng 1 chỗ.
 */

// TODO: thay toàn bộ bằng thông tin thật (sau này đọc từ model ContactInfo)
const teacherContact = {
  name: "Thầy/Cô [Tên giáo viên]",
  phone: "0000 000 000",
  email: "contact@bqdmath.edu.vn",
  address: "[Địa chỉ sẽ cập nhật]",
  mapUrl: "#", // TODO: link Google Maps thật
  facebook: "#", // TODO: link Facebook thật
};

/** Bỏ "Trang chủ" khỏi cột liên kết nhanh — logo ở navbar đã lo việc đó. */
const quickLinks = NAV_LINKS.filter((link) => link.href !== "/");

export function Footer() {
  return (
    <footer className="mt-auto border-t border-navy-100 bg-pastel-50">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr_1.3fr]">
          {/* --- Cột 1: giới thiệu ngắn --- */}
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-navy-500 transition-opacity hover:opacity-70"
            >
              BQD<span className="text-navy-300">Math</span>
            </Link>
            <h2 className="text-sm font-semibold text-navy-500">Về BQD Math</h2>
            <p className="max-w-sm text-sm leading-relaxed text-navy-400">
              {/* TODO: thay bằng mô tả thật về trung tâm */}
              Hệ thống ôn luyện &amp; thi thử Toán: câu hỏi ôn tập theo chương,
              phòng thi thử chấm điểm tự động và kho tài liệu cho lớp Cơ bản lẫn
              Nâng cao.
            </p>
          </div>

          {/* --- Cột 2: liên kết nhanh (dùng lại NAV_LINKS) --- */}
          <nav aria-label="Liên kết nhanh" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-navy-500">
              Liên kết nhanh
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-navy-400 transition-colors hover:text-navy-600"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* --- Cột 3: thông tin giáo viên, card kính nhẹ --- */}
          <div className="rounded-[2rem] border border-white/50 bg-pastel-100/60 p-5 shadow-[0_8px_32px_rgba(27,42,74,0.1)] backdrop-blur-xl">
            <h2 className="text-sm font-semibold text-navy-500">
              Thông tin giáo viên
            </h2>
            <p className="mt-2 text-base font-semibold text-navy-600">
              {teacherContact.name}
            </p>

            <ul className="mt-4 flex flex-col gap-3 text-sm text-navy-400">
              <li>
                <a
                  href={`tel:${teacherContact.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-navy-600"
                >
                  <Phone className="size-4 shrink-0 text-navy-300" aria-hidden />
                  {teacherContact.phone}
                  <span className="text-xs text-navy-200">(Zalo)</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${teacherContact.email}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-navy-600"
                >
                  <Mail className="size-4 shrink-0 text-navy-300" aria-hidden />
                  {teacherContact.email}
                </a>
              </li>
              <li>
                <a
                  href={teacherContact.mapUrl}
                  className="flex items-start gap-2.5 transition-colors hover:text-navy-600"
                >
                  <MapPin
                    className="mt-0.5 size-4 shrink-0 text-navy-300"
                    aria-hidden
                  />
                  {teacherContact.address}
                </a>
              </li>
              <li>
                <a
                  href={teacherContact.facebook}
                  className="flex items-center gap-2.5 transition-colors hover:text-navy-600"
                >
                  <FacebookIcon className="size-4 shrink-0 text-navy-300" />
                  Facebook
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-navy-100 pt-6 text-sm text-navy-400">
          <p>
            © {new Date().getFullYear()} BQD Math — Hệ thống ôn luyện &amp; thi
            thử Toán
          </p>
        </div>
      </div>
    </footer>
  );
}
