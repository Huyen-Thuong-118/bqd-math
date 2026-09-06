"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { signOut } from "next-auth/react";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";

import { cn } from "@/lib/utils";
import { changePassword } from "../actions/change-password";
import {
  validateConfirmPassword,
  validateRegisterPassword,
} from "../lib/validation";

type Field = "currentPassword" | "password" | "confirmPassword";
type FormErrors = Partial<Record<Field, string>>;

const inputClass = "w-full rounded-2xl border border-navy-100 bg-pastel-50/60 px-4 py-3 pr-11 text-sm text-navy-500 outline-none transition-colors focus:border-navy-400 focus:bg-white";

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [values, setValues] = useState<Record<Field, string>>({ currentPassword: "", password: "", confirmPassword: "" });
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function detectCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {
      currentPassword: values.currentPassword ? undefined : "Vui lòng nhập mật khẩu hiện tại",
      password: validateRegisterPassword(values.password),
      confirmPassword: validateConfirmPassword(values.confirmPassword, values.password),
    };
    setErrors(nextErrors);
    setGeneralError(undefined);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    const result = await changePassword(values);
    if (!result.success) {
      setIsSubmitting(false);
      if (result.field) setErrors((current) => ({ ...current, [result.field!]: result.error }));
      else setGeneralError(result.error);
      return;
    }
    await signOut({ redirectTo: "/dang-nhap?passwordChanged=1" });
  }

  if (!hasPassword) {
    return (
      <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
        Tài khoản này đăng nhập bằng Google và chưa có mật khẩu. Hãy dùng trang
        <a href="/quen-mat-khau" className="ml-1 font-semibold underline">Quên mật khẩu</a>
        để xác minh email trước khi tạo mật khẩu.
      </div>
    );
  }

  const fields: { field: Field; label: string; autoComplete: string; placeholder: string }[] = [
    { field: "currentPassword", label: "Mật khẩu hiện tại", autoComplete: "current-password", placeholder: "Nhập mật khẩu đang dùng" },
    { field: "password", label: "Mật khẩu mới", autoComplete: "new-password", placeholder: "Ít nhất 8 ký tự, có chữ và số" },
    { field: "confirmPassword", label: "Nhập lại mật khẩu mới", autoComplete: "new-password", placeholder: "Nhập lại mật khẩu mới" },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
      {fields.map(({ field, label, autoComplete, placeholder }) => (
        <div key={field} className="flex flex-col gap-1.5">
          <label htmlFor={field} className="text-sm font-medium text-navy-500">{label}</label>
          <div className="relative">
            <input
              id={field}
              type={show ? "text" : "password"}
              value={values[field]}
              onChange={(event) => update(field, event.target.value)}
              onKeyDown={detectCapsLock}
              onKeyUp={detectCapsLock}
              onBlur={() => setCapsLock(false)}
              autoComplete={autoComplete}
              maxLength={128}
              aria-invalid={Boolean(errors[field])}
              className={cn(inputClass, errors[field] && "border-accent-500")}
              placeholder={placeholder}
            />
            <button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="absolute top-1/2 right-3 -translate-y-1/2 text-navy-300">
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          {errors[field] && <p className="text-xs text-accent-500">{errors[field]}</p>}
        </div>
      ))}
      {capsLock && <p className="text-xs font-medium text-amber-700">Caps Lock đang bật.</p>}
      <p className="text-xs leading-relaxed text-navy-300">Sau khi đổi thành công, bạn sẽ được đăng xuất và cần đăng nhập lại bằng mật khẩu mới.</p>
      {generalError && <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{generalError}</p>}
      <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-navy-500 to-navy-700 px-6 py-3 text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-70">
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LockKeyhole className="size-4" aria-hidden />}
        {isSubmitting ? "Đang đổi mật khẩu…" : "Đổi mật khẩu"}
      </button>
    </form>
  );
}
