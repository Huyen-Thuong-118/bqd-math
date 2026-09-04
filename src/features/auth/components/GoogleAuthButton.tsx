"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

/** lucide-react v1 đã bỏ icon thương hiệu (xem Footer.tsx) — vẽ tay logo
 * Google 4 màu, khỏi thêm package chỉ để lấy 1 icon. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63l3.86 3c2.27-2.09 3.59-5.17 3.59-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3c-1.08.73-2.46 1.16-4.08 1.16-3.13 0-5.79-2.11-6.74-4.96H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.26 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.27a12 12 0 0 0 0 10.8l3.99-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.6l3.99 3.11C6.21 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function GoogleAuthButton({ label }: { label: string }) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    try {
      // redirect mặc định true — signIn() tự điều hướng sang Google, chỉ
      // reset loading nếu có lỗi xảy ra TRƯỚC khi kịp chuyển trang.
      await signIn("google");
    } catch {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-navy-200/60 bg-white px-6 py-3 text-sm font-medium text-navy-500 transition-colors hover:bg-pastel-50 disabled:pointer-events-none disabled:opacity-70"
    >
      {isLoading ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : (
        <GoogleIcon />
      )}
      {label}
    </button>
  );
}
