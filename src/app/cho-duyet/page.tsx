import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Đang chờ duyệt | BQD Math",
};

// Proxy (src/proxy.ts) điều hướng HS có status PENDING vào đây khi cố vào
// trang cần đăng nhập — dùng chung style card với app/(auth) cho nhất quán.
export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-pastel-100 px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-[0_20px_60px_rgba(27,42,74,0.12)] sm:p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100">
          <Clock className="size-8 text-amber-600" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-navy-500">
          Tài khoản đang chờ duyệt
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-navy-400">
          Tài khoản của bạn đang chờ admin phê duyệt. Bạn sẽ nhận được email
          thông báo khi tài khoản được kích hoạt.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-linear-to-r from-navy-500 to-navy-700 px-8 py-3 text-sm font-semibold text-pastel-50 shadow-[0_8px_24px_rgba(27,42,74,0.28)] transition-all hover:-translate-y-0.5"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
