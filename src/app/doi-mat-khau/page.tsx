import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { auth } from "@/auth";
import { ChangeTemporaryPasswordForm } from "@/features/auth/components/ChangeTemporaryPasswordForm";
import {
  findAccountAccess,
  getAccountDestination,
} from "@/features/auth/lib/account-access";

export const metadata: Metadata = {
  title: "Đổi mật khẩu | BQD Math",
};
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/dang-nhap");

  const account = await findAccountAccess(session.user.id);
  if (!account) redirect("/dang-nhap");
  if (
    account.role !== "STUDENT" ||
    account.status !== "ACTIVE" ||
    !account.mustChangePassword
  ) {
    redirect(getAccountDestination(account));
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-pastel-100 px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-[0_20px_60px_rgba(27,42,74,0.12)] sm:p-10">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-navy-500 text-white">
          <KeyRound className="size-7" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-navy-500">
          Tạo mật khẩu riêng
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-navy-400">
          Bạn đang dùng mật khẩu tạm do giáo viên cấp. Hãy đổi mật khẩu trước
          khi tiếp tục vào khu vực học tập.
        </p>
        <ChangeTemporaryPasswordForm />
      </div>
    </main>
  );
}
