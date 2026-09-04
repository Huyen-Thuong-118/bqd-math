"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Loader2, Mail } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  validateConfirmPassword,
  validateEmail,
  validateRegisterPassword,
} from "../lib/validation";

const inputClass =
  "w-full rounded-2xl border border-navy-100 bg-pastel-50/60 px-4 py-3 text-sm text-navy-500 placeholder:text-navy-300/70 outline-none transition-colors focus:border-navy-400 focus:bg-white";
const errorInputClass = "border-accent-500/70 focus:border-accent-500";
const primaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-navy-500 to-navy-700 px-6 py-3 text-sm font-semibold text-pastel-50 shadow-[0_8px_24px_rgba(27,42,74,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(27,42,74,0.35)] disabled:pointer-events-none disabled:opacity-70";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

/** 4 = màn thành công, không tính vào thanh tiến trình 1/2/3. */
type Step = 1 | 2 | 3 | 4;

// Message mặc định phòng khi request-otp không phản hồi được (lỗi mạng) —
// giữ đúng nội dung chung server luôn trả về lúc thành công, không lộ thêm
// thông tin nào so với khi gọi API thật trót lọt.
const DEFAULT_OTP_SENT_MESSAGE =
  "Nếu email tồn tại trong hệ thống, mã OTP đã được gửi";

export function ForgotPasswordFlow() {
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bước 1
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();

  // Bước 2
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState<string>();
  const [infoMessage, setInfoMessage] = useState<string>();
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(RESEND_SECONDS);
  const [resetToken, setResetToken] = useState<string>();

  // Bước 3
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [resetPasswordError, setResetPasswordError] = useState<string>();

  // Đếm ngược "Gửi lại mã" — chỉ chạy khi đang ở bước 2 và còn giây để đếm.
  useEffect(() => {
    if (step !== 2 || resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  // LUÔN chuyển sang bước 2 sau khi gọi xong, bất kể email có tồn tại hay
  // request lỗi mạng — server cố tình không tiết lộ email có đăng ký hay
  // không (xem route request-otp), UI vì vậy cũng không được phép suy luận
  // ngược lại từ việc "gọi API thất bại".
  async function requestOtp() {
    try {
      const response = await fetch("/api/auth/forgot-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setInfoMessage(
        typeof data?.message === "string" ? data.message : DEFAULT_OTP_SENT_MESSAGE,
      );
    } catch {
      setInfoMessage(DEFAULT_OTP_SENT_MESSAGE);
    }
  }

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateEmail(email);
    setEmailError(error);
    if (error) return;

    setIsSubmitting(true);
    await requestOtp();
    setIsSubmitting(false);
    setOtp(Array(OTP_LENGTH).fill(""));
    setOtpError(undefined);
    setResendCooldown(RESEND_SECONDS);
    setStep(2);
  }

  function handleOtpChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    // Ô đang trống mà bấm Backspace: nhảy về ô trước để xoá tiếp, giống hành
    // vi OTP input quen thuộc (Google, ngân hàng...).
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = otp.join("");
    if (code.length < OTP_LENGTH) {
      setOtpError("Vui lòng nhập đủ 6 số");
      return;
    }
    setOtpError(undefined);

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await response.json();

      if (!response.ok || typeof data?.resetToken !== "string") {
        setOtpError(data?.error ?? "Mã OTP không đúng hoặc đã hết hạn");
        return;
      }

      setResetToken(data.resetToken);
      setStep(3);
    } catch {
      setOtpError("Không thể xác thực lúc này, vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setResendCooldown(RESEND_SECONDS);
    setOtp(Array(OTP_LENGTH).fill(""));
    setOtpError(undefined);
    await requestOtp();
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = {
      newPassword: validateRegisterPassword(newPassword),
      confirmPassword: validateConfirmPassword(confirmPassword, newPassword),
    };
    setPasswordErrors(nextErrors);
    setResetPasswordError(undefined);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword, confirmPassword }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setResetPasswordError(data?.error ?? "Đã có lỗi xảy ra, vui lòng thử lại.");
        return;
      }

      setStep(4);
    } catch {
      setResetPasswordError("Không thể đặt lại mật khẩu lúc này, vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 4) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <CheckCircle2 className="size-16 text-navy-500" aria-hidden />
        <h1 className="text-2xl font-semibold text-navy-500">
          Đặt lại mật khẩu thành công
        </h1>
        <p className="text-sm text-navy-400">
          Mật khẩu của bạn đã được cập nhật. Hãy đăng nhập lại bằng mật khẩu
          mới.
        </p>
        <Link href="/dang-nhap" className={cn(primaryButtonClass, "mt-2 w-auto px-8")}>
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-navy-500">Quên mật khẩu</h1>
        <p className="text-sm text-navy-300">
          {step === 1 && "Nhập email để nhận mã xác thực"}
          {step === 2 && "Kiểm tra email và nhập mã OTP"}
          {step === 3 && "Tạo mật khẩu mới cho tài khoản"}
        </p>
      </div>

      <div className="flex items-center gap-2" aria-hidden>
        {([1, 2, 3] as const).map((s) => (
          <span
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              s <= step ? "bg-navy-500" : "bg-navy-100",
            )}
          />
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={handleSendOtp} noValidate className="flex flex-col gap-4">
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
              aria-invalid={Boolean(emailError)}
              className={cn(inputClass, emailError && errorInputClass)}
              placeholder="ban@email.com"
            />
            {emailError && <p className="text-xs text-accent-500">{emailError}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Mail className="size-4" aria-hidden />
            )}
            Gửi mã OTP
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyOtp} noValidate className="flex flex-col gap-4">
          <p className="text-sm text-navy-400">
            {infoMessage ?? DEFAULT_OTP_SENT_MESSAGE}
          </p>

          <div className="flex justify-between gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  otpInputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(event) => handleOtpChange(index, event.target.value)}
                onKeyDown={(event) => handleOtpKeyDown(index, event)}
                aria-label={`Số thứ ${index + 1} của mã OTP`}
                aria-invalid={Boolean(otpError)}
                className={cn(
                  "size-12 rounded-2xl border border-navy-100 bg-pastel-50/60 text-center text-lg font-semibold text-navy-500 outline-none transition-colors focus:border-navy-400 focus:bg-white",
                  otpError && errorInputClass,
                )}
              />
            ))}
          </div>
          {otpError && <p className="text-xs text-accent-500">{otpError}</p>}

          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Xác thực
          </button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendCooldown > 0}
            className="text-center text-sm font-medium text-navy-500 transition-colors hover:underline disabled:cursor-not-allowed disabled:text-navy-300 disabled:no-underline"
          >
            {resendCooldown > 0 ? `Gửi lại mã (${resendCooldown}s)` : "Gửi lại mã"}
          </button>
        </form>
      )}

      {step === 3 && (
        <form
          onSubmit={handleResetPassword}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="newPassword" className="text-sm font-medium text-navy-500">
              Mật khẩu mới
            </label>
            <div className="relative">
              <input
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                aria-invalid={Boolean(passwordErrors.newPassword)}
                className={cn(
                  inputClass,
                  "pr-11",
                  passwordErrors.newPassword && errorInputClass,
                )}
                placeholder="Tối thiểu 8 ký tự, có chữ và số"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-navy-300 transition-colors hover:text-navy-500"
              >
                {showNewPassword ? (
                  <EyeOff className="size-5" aria-hidden />
                ) : (
                  <Eye className="size-5" aria-hidden />
                )}
              </button>
            </div>
            {passwordErrors.newPassword && (
              <p className="text-xs text-accent-500">{passwordErrors.newPassword}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-navy-500"
            >
              Xác nhận mật khẩu mới
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                aria-invalid={Boolean(passwordErrors.confirmPassword)}
                className={cn(
                  inputClass,
                  "pr-11",
                  passwordErrors.confirmPassword && errorInputClass,
                )}
                placeholder="Nhập lại mật khẩu mới"
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
            {passwordErrors.confirmPassword && (
              <p className="text-xs text-accent-500">
                {passwordErrors.confirmPassword}
              </p>
            )}
          </div>

          {resetPasswordError && (
            <p className="rounded-2xl bg-accent-400/10 px-4 py-2.5 text-sm text-accent-500">
              {resetPasswordError}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Đặt lại mật khẩu
          </button>
        </form>
      )}
    </div>
  );
}
