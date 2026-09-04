"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { register } from "../actions/register";
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateParentPhone,
  validatePhone,
  validateRegisterPassword,
} from "../lib/validation";
import { GoogleAuthButton } from "./GoogleAuthButton";

const inputClass =
  "w-full rounded-2xl border border-navy-100 bg-pastel-50/60 px-4 py-3 text-sm text-navy-500 placeholder:text-navy-300/70 outline-none transition-colors focus:border-navy-400 focus:bg-white";
const errorInputClass = "border-accent-500/70 focus:border-accent-500";
const primaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-navy-500 to-navy-700 px-6 py-3 text-sm font-semibold text-pastel-50 shadow-[0_8px_24px_rgba(27,42,74,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(27,42,74,0.35)] disabled:pointer-events-none disabled:opacity-70";

type FieldName =
  | "fullName"
  | "studentPhone"
  | "parentPhone"
  | "email"
  | "password"
  | "confirmPassword"
  | "agree";

type FormErrors = Partial<Record<FieldName, string>>;

export function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {
      fullName: validateFullName(fullName),
      studentPhone: validatePhone(studentPhone),
      parentPhone: validateParentPhone(parentPhone, studentPhone),
      email: validateEmail(email),
      password: validateRegisterPassword(password),
      confirmPassword: validateConfirmPassword(confirmPassword, password),
      agree: agree
        ? undefined
        : "Vui lòng đồng ý Điều khoản sử dụng và Chính sách bảo mật",
    };
    setErrors(nextErrors);
    setGeneralError(undefined);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    const result = await register({
      fullName,
      studentPhone,
      parentPhone,
      email,
      password,
      confirmPassword,
    });
    setIsSubmitting(false);

    if (!result.success) {
      const { field, error } = result;
      if (field) {
        setErrors((prev) => ({ ...prev, [field]: error }));
      } else {
        setGeneralError(error);
      }
      return;
    }

    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <CheckCircle2 className="size-16 text-navy-500" aria-hidden />
        <h1 className="text-2xl font-semibold text-navy-500">
          Đăng ký thành công
        </h1>
        <p className="text-sm text-navy-400">
          Tài khoản của bạn đang chờ admin phê duyệt. Bạn sẽ nhận được email
          thông báo khi tài khoản được kích hoạt.
        </p>
        <Link
          href="/dang-nhap"
          className={cn(primaryButtonClass, "mt-2 w-auto px-8")}
        >
          Về trang đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-navy-500">Đăng ký</h1>
        <p className="text-sm text-navy-300">
          Tạo tài khoản để bắt đầu ôn luyện cùng BQD Math
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fullName" className="text-sm font-medium text-navy-500">
            Họ và tên
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            aria-invalid={Boolean(errors.fullName)}
            className={cn(inputClass, errors.fullName && errorInputClass)}
            placeholder="Nguyễn Văn A"
          />
          {errors.fullName && (
            <p className="text-xs text-accent-500">{errors.fullName}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="studentPhone" className="text-sm font-medium text-navy-500">
            Số điện thoại học sinh
          </label>
          <input
            id="studentPhone"
            name="studentPhone"
            type="tel"
            autoComplete="tel"
            value={studentPhone}
            onChange={(event) => setStudentPhone(event.target.value)}
            aria-invalid={Boolean(errors.studentPhone)}
            className={cn(inputClass, errors.studentPhone && errorInputClass)}
            placeholder="0912345678"
          />
          {errors.studentPhone && (
            <p className="text-xs text-accent-500">{errors.studentPhone}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="parentPhone" className="text-sm font-medium text-navy-500">
            Số điện thoại phụ huynh
          </label>
          <input
            id="parentPhone"
            name="parentPhone"
            type="tel"
            autoComplete="tel"
            value={parentPhone}
            onChange={(event) => setParentPhone(event.target.value)}
            aria-invalid={Boolean(errors.parentPhone)}
            className={cn(inputClass, errors.parentPhone && errorInputClass)}
            placeholder="0987654321"
          />
          {errors.parentPhone && (
            <p className="text-xs text-accent-500">{errors.parentPhone}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-navy-500">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            className={cn(inputClass, errors.email && errorInputClass)}
            placeholder="ban@email.com"
          />
          {errors.email && <p className="text-xs text-accent-500">{errors.email}</p>}
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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
              className={cn(inputClass, "pr-11", errors.password && errorInputClass)}
              placeholder="Tối thiểu 8 ký tự, có chữ và số"
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
            <p className="text-xs text-accent-500">{errors.password}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-navy-500"
          >
            Xác nhận mật khẩu
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={Boolean(errors.confirmPassword)}
              className={cn(
                inputClass,
                "pr-11",
                errors.confirmPassword && errorInputClass,
              )}
              placeholder="Nhập lại mật khẩu"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-navy-300 transition-colors hover:text-navy-500"
            >
              {showConfirmPassword ? (
                <EyeOff className="size-5" aria-hidden />
              ) : (
                <Eye className="size-5" aria-hidden />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-accent-500">{errors.confirmPassword}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-2.5 text-sm text-navy-400">
            <input
              type="checkbox"
              checked={agree}
              onChange={(event) => setAgree(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded accent-navy-500"
            />
            <span>
              Tôi đã đọc và đồng ý{" "}
              <a href="#" className="font-medium text-navy-500 hover:underline">
                Điều khoản sử dụng
              </a>{" "}
              và{" "}
              <a href="#" className="font-medium text-navy-500 hover:underline">
                Chính sách bảo mật
              </a>
            </span>
          </label>
          {errors.agree && <p className="text-xs text-accent-500">{errors.agree}</p>}
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
            <UserPlus className="size-4" aria-hidden />
          )}
          Đăng ký
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-navy-300">
        <span className="h-px flex-1 bg-navy-100" />
        hoặc
        <span className="h-px flex-1 bg-navy-100" />
      </div>

      <GoogleAuthButton label="Đăng ký bằng Google" />

      <p className="text-center text-sm text-navy-400">
        Đã có tài khoản?{" "}
        <Link href="/dang-nhap" className="font-semibold text-navy-500 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
