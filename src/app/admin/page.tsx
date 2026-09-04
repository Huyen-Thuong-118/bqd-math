import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  FileQuestionMark,
  GraduationCap,
  UserCheck,
} from "lucide-react";

import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard | BQD Math",
};

// Lý do y hệt hoc-sinh/page.tsx: trang không dùng dynamic API nào (không
// cookies()/headers()/searchParams, không tự gọi auth() — proxy đã chặn
// /admin/** trước khi request tới đây) và db.*.count() là lệnh Prisma thuần,
// không phải fetch() nên không tự tham gia Data Cache của Next. Không ép
// dynamic thì 4 số liệu sẽ đứng im ở đúng snapshot lúc build cho tới lần
// deploy kế tiếp — dashboard vì vậy luôn phải fresh.
export const dynamic = "force-dynamic";

// Server Component: query thẳng Prisma, không qua route API riêng — 4 count
// độc lập nhau nên chạy song song bằng Promise.all thay vì await tuần tự.
export default async function AdminDashboardPage() {
  const [pendingCount, activeCount, classCount, examCount] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", status: "PENDING" } }),
    // + role: "STUDENT" bắt buộc — chỉ lọc status: "ACTIVE" sẽ đếm luôn tài
    // khoản ADMIN, sai với nhãn "Học sinh đang hoạt động".
    db.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    db.class.count(),
    db.exam.count(),
  ]);

  const stats = [
    {
      href: "/admin/hoc-sinh",
      label: "Học sinh chờ duyệt",
      value: pendingCount,
      icon: Clock,
      pending: pendingCount > 0,
    },
    {
      href: "/admin/hoc-sinh",
      label: "Học sinh đang hoạt động",
      value: activeCount,
      icon: UserCheck,
      pending: false,
    },
    {
      href: "/admin/lop-hoc",
      label: "Tổng số lớp",
      value: classCount,
      icon: GraduationCap,
      pending: false,
    },
    {
      href: "/admin/de-thi",
      label: "Đề thi thử",
      value: examCount,
      icon: FileQuestionMark,
      pending: false,
    },
  ] as const;

  const quickActions = [
    {
      href: "/admin/hoc-sinh",
      label: "Duyệt học sinh",
      icon: Clock,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    {
      href: "/admin/lop-hoc",
      label: "+ Tạo lớp mới",
      icon: GraduationCap,
      badge: null,
    },
    {
      href: "/admin/de-thi",
      label: "+ Thêm đề thi thử",
      icon: FileQuestionMark,
      badge: null,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-navy-600">Dashboard</h1>
        <p className="mt-1 text-sm text-navy-300">
          Tổng quan số liệu và lối tắt tới các tác vụ quản trị thường dùng.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className={cn(
                "relative rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-lg",
                stat.pending
                  ? "border-amber-300 bg-amber-50"
                  : "border-navy-100 bg-white",
              )}
            >
              {stat.pending && (
                <span className="absolute top-4 right-4 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {stat.value}
                </span>
              )}
              <Icon
                className={cn(
                  "size-7",
                  stat.pending ? "text-amber-600" : "text-navy-400",
                )}
                aria-hidden
              />
              <p className="mt-3 text-3xl font-bold text-navy-500">{stat.value}</p>
              <p className="mt-1 text-sm text-navy-400">{stat.label}</p>
            </Link>
          );
        })}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-navy-500">Thao tác nhanh</h2>
        <div className="mt-3 flex flex-col gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-white px-4 py-3.5 transition-colors hover:bg-pastel-50"
              >
                <Icon className="size-5 text-navy-400" aria-hidden />
                <span className="flex-1 text-sm font-medium text-navy-500">
                  {action.label}
                </span>
                {action.badge !== null && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {action.badge}
                  </span>
                )}
                <ArrowRight className="size-4 text-navy-300" aria-hidden />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
