import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserRoundCheck } from "lucide-react";

import { auth } from "@/auth";
import { CompleteGoogleProfileForm } from "@/features/auth/components/CompleteGoogleProfileForm";
import {
  findAccountAccess,
  getAccountDestination,
} from "@/features/auth/lib/account-access";

export const metadata: Metadata = {
  title: "Hoàn tất hồ sơ | BQD Math",
};
export const dynamic = "force-dynamic";

export default async function CompleteProfilePage() {
  const session = await auth();
  if (!session?.user.id) redirect("/dang-nhap");

  const account = await findAccountAccess(session.user.id);
  if (!account) redirect("/dang-nhap");
  if (
    account.role !== "STUDENT" ||
    (account.studentPhone && account.parentPhone) ||
    account.status === "SUSPENDED"
  ) {
    redirect(getAccountDestination(account));
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-pastel-100 px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-[0_20px_60px_rgba(27,42,74,0.12)] sm:p-10">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-navy-500 text-white">
          <UserRoundCheck className="size-7" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-navy-500">
          Hoàn tất hồ sơ học sinh
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-navy-400">
          Google không cung cấp số điện thoại. Hãy bổ sung hai số liên hệ để
          giáo viên nhận diện và duyệt tài khoản của bạn.
        </p>
        <CompleteGoogleProfileForm email={session.user.email ?? ""} />
      </div>
    </main>
  );
}
