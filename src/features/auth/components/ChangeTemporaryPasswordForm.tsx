"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";

import { cn } from "@/lib/utils";
import { changeTemporaryPassword } from "../actions/change-temporary-password";
import {
  validateConfirmPassword,
  validateRegisterPassword,
} from "../lib/validation";

const inputClass =
  "w-full rounded-2xl border border-navy-100 bg-pastel-50/60 px-4 py-3 pr-11 text-sm text-navy-500 outline-none transition-colors focus:border-navy-400 focus:bg-white";

type FormErrors = Partial<Record<"password" | "confirmPassword", string>>;

export function ChangeTemporaryPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {
      password: validateRegisterPassword(password),
      confirmPassword: validateConfirmPassword(confirmPassword, password),
    };
    setErrors(nextErrors);
    setGeneralError(undefined);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    const result = await changeTemporaryPassword({ password, confirmPassword });
    setIsSubmitting(false);
    if (!result.success) {
      if (result.field) {
        setErrors((current) => ({ ...current, [result.field!]: result.error }));
      } else {
        setGeneralError(result.error);
      }
      return;
    }

    router.replace("/sau-dang-nhap");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <PasswordField
        id="newPassword"
        label="Mật khẩu mới"
        value={password}
        onChange={setPassword}
        show={showPassword}
        toggle={() => setShowPassword((value) => !value)}
        error={errors.password}
        autoComplete="new-password"
      />
      <PasswordField
        id="confirmPassword"
        label="Nhập lại mật khẩu mới"
        value={confirmPassword}
        onChange={setConfirmPassword}
        show={showPassword}
        toggle={() => setShowPassword((value) => !value)}
        error={errors.confirmPassword}
        autoComplete="new-password"
      />

      {generalError && (
        <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {generalError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-navy-500 to-navy-700 px-6 py-3 text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-70"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <LockKeyhole className="size-4" aria-hidden />
        )}
        Đổi mật khẩu
      </button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  toggle,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  toggle: () => void;
  error?: string;
  autoComplete: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-navy-500">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn(inputClass, error && "border-accent-500")}
          placeholder="Ít nhất 8 ký tự, có chữ và số"
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-navy-300"
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {error && <p className="text-xs text-accent-500">{error}</p>}
    </div>
  );
}
