"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2, LogOut } from "lucide-react";

export function SignOutButton() {
  const [isPending, setIsPending] = useState(false);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        await signOut({ redirectTo: "/dang-nhap" });
      }}
      className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-navy-200 px-6 py-2.5 text-sm font-medium text-navy-500 disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="size-4" aria-hidden />
      )}
      Đăng xuất
    </button>
  );
}
