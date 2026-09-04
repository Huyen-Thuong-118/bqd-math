"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";

import { cn } from "@/lib/utils";
import { validateLoginIdentifier, validateLoginPassword } from "../lib/validation";
import { GoogleAuthButton } from "./GoogleAuthButton";

const inputClass =
  "w-full rounded-2xl border border-navy-100 bg-pastel-50/60 px-4 py-3 text-sm text-navy-500 placeholder:text-navy-300/70 outline-none transition-colors focus:border-navy-400 focus:bg-white";
const errorInputClass = "border-accent-500/70 focus:border-accent-500";
const primaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-navy-500 to-navy-700 px-6 py-3 text-sm font-semibold text-pastel-50 shadow-[0_8px_24px_rgba(27,42,74,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(27,42,74,0.35)] disabled:pointer-events-none disabled:opacity-70";

type FormErrors = Partial<Record<"identifier" | "password", string>>;

// `code` khớp với các class lỗi throw trong src/auth.ts (InvalidCredentialsError...).
const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  "invalid-credentials": "Sai thông tin đăng nhập",
  "account-pending": "Tài khoản đang chờ admin duyệt",
  "account-suspended": "Tài khoản đã bị thu hồi quyền truy cập",
};

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {
      identifier: validateLoginIdentifier(identifier),
      password: validateLoginPassword(password),
    };
    setErrors(nextErrors);
    setGeneralError(undefined);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    const result = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
    });

    if (result?.error) {
      setGeneralError(
        LOGIN_ERROR_MESSAGES[result.code ?? ""] ?? "Sai thông tin đăng nhập",
      );
      setIsSubmitting(false);
      return;
    }

    // signIn() không tự trả về session mới — gọi lại để biết role, quyết
    // định điều hướng admin hay trang chủ.
    const session = await getSession();
    router.push(session?.user.role === "ADMIN" ? "/admin" : "/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-navy-500">Đăng nhập</h1>
        <p className="text-sm text-navy-300">
          Chào mừng bạn quay trở lại BQD Math
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="identifier" className="text-sm font-medium text-navy-500">
            Số điện thoại hoặc Email
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            aria-invalid={Boolean(errors.identifier)}
            aria-describedby={errors.identifier ? "identifier-error" : undefined}
            className={cn(inputClass, errors.identifier && errorInputClass)}
            placeholder="0912345678 hoặc ban@email.com"
          />
          {errors.identifier && (
            <p id="identifier-error" className="text-xs text-accent-500">
              {errors.identifier}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-navy-500">
            Mật khẩu
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={cn(inputClass, "pr-11", errors.password && errorInputClass)}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-navy-300 transition-colors hover:text-navy-500"
            >
              {showPassword ? (
                <EyeOff className="size-5" aria-hidden />
              ) : (
                <Eye className="size-5" aria-hidden />
              )}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-xs text-accent-500">
              {errors.password}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-navy-400">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="size-4 rounded accent-navy-500"
            />
            Ghi nhớ đăng nhập
          </label>
          <Link
            href="/quen-mat-khau"
            className="font-medium text-navy-500 hover:underline"
          >
            Quên mật khẩu?
          </Link>
        </div>

        {generalError && (
          <p className="rounded-2xl bg-accent-400/10 px-4 py-2.5 text-sm text-accent-500">
            {generalError}
          </p>
        )}

        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <LogIn className="size-4" aria-hidden />
          )}
          Đăng nhập
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-navy-300">
        <span className="h-px flex-1 bg-navy-100" />
        hoặc
        <span className="h-px flex-1 bg-navy-100" />
      </div>

      <GoogleAuthButton label="Đăng nhập bằng Google" />

      <p className="text-center text-sm text-navy-400">
        Chưa có tài khoản?{" "}
        <Link href="/dang-ky" className="font-semibold text-navy-500 hover:underline">
          Đăng ký
        </Link>
      </p>
    </div>
  );
}
