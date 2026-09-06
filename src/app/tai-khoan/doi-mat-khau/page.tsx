import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { auth } from "@/auth";
import { ChangePasswordForm } from "@/features/auth/components/ChangePasswordForm";
import { getAccountDestination } from "@/features/auth/lib/account-access";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Đổi mật khẩu | BQD Math" };
export const dynamic = "force-dynamic";

export default async function AccountChangePasswordPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/dang-nhap");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      status: true,
      mustChangePassword: true,
      passwordHash: true,
      studentPhone: true,
      parentPhone: true,
    },
  });
  if (!user) redirect("/dang-nhap");
  if (user.status !== "ACTIVE") redirect(getAccountDestination(user));
  if (user.role === "STUDENT" && user.mustChangePassword) redirect("/doi-mat-khau");

  const backHref = user.role === "ADMIN" ? "/admin" : "/lop-hoc";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-pastel-100 px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-[0_20px_60px_rgba(27,42,74,0.12)] sm:p-10">
        <Link href={backHref} className="text-sm font-semibold text-navy-400">← Quay lại</Link>
        <div className="mt-5 flex size-14 items-center justify-center rounded-2xl bg-navy-500 text-white"><KeyRound className="size-7" aria-hidden /></div>
        <h1 className="mt-4 text-2xl font-semibold text-navy-500">Đổi mật khẩu</h1>
        <p className="mt-2 text-sm leading-relaxed text-navy-400">Xác nhận mật khẩu hiện tại trước khi tạo mật khẩu mới cho tài khoản.</p>
        <ChangePasswordForm hasPassword={Boolean(user.passwordHash)} />
      </div>
    </main>
  );
}
