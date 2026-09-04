import type { Metadata } from "next";
import Link from "next/link";
import { ShieldOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Tài khoản bị khóa | BQD Math",
};

// Proxy (src/proxy.ts) điều hướng HS có status SUSPENDED vào đây — dùng chung
// style card với app/(auth) cho nhất quán.
export default function AccountSuspendedPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-pastel-100 px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-[0_20px_60px_rgba(27,42,74,0.12)] sm:p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-100">
          <ShieldOff className="size-8 text-red-600" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-navy-500">
          Tài khoản đã bị khóa
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-navy-400">
          Tài khoản đã bị thu hồi quyền truy cập, liên hệ giáo viên để biết
          thêm chi tiết.
        </p>
        <Link
          href="/lien-he"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-linear-to-r from-navy-500 to-navy-700 px-8 py-3 text-sm font-semibold text-pastel-50 shadow-[0_8px_24px_rgba(27,42,74,0.28)] transition-all hover:-translate-y-0.5"
        >
          Đi tới trang Liên hệ
        </Link>
      </div>
    </div>
  );
}
