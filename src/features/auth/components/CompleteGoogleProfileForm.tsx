"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

import { cn } from "@/lib/utils";
import { completeGoogleProfile } from "../actions/complete-google-profile";
import { validateParentPhone, validatePhone } from "../lib/validation";

const inputClass =
  "w-full rounded-2xl border border-navy-100 bg-pastel-50/60 px-4 py-3 text-sm text-navy-500 placeholder:text-navy-300/70 outline-none transition-colors focus:border-navy-400 focus:bg-white";

type FormErrors = Partial<Record<"studentPhone" | "parentPhone", string>>;

export function CompleteGoogleProfileForm({ email }: { email: string }) {
  const router = useRouter();
  const [studentPhone, setStudentPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {
      studentPhone: validatePhone(studentPhone),
      parentPhone: validateParentPhone(parentPhone, studentPhone),
    };
    setErrors(nextErrors);
    setGeneralError(undefined);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    const result = await completeGoogleProfile({ studentPhone, parentPhone });
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
      <div className="rounded-2xl bg-pastel-100 px-4 py-3 text-sm text-navy-400">
        Google: <span className="font-medium text-navy-500">{email}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="studentPhone" className="text-sm font-medium text-navy-500">
          Số điện thoại học sinh
        </label>
        <input
          id="studentPhone"
          type="tel"
          autoComplete="tel"
          value={studentPhone}
          onChange={(event) => setStudentPhone(event.target.value)}
          aria-invalid={Boolean(errors.studentPhone)}
          className={cn(inputClass, errors.studentPhone && "border-accent-500")}
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
          type="tel"
          autoComplete="tel"
          value={parentPhone}
          onChange={(event) => setParentPhone(event.target.value)}
          aria-invalid={Boolean(errors.parentPhone)}
          className={cn(inputClass, errors.parentPhone && "border-accent-500")}
          placeholder="0987654321"
        />
        {errors.parentPhone && (
          <p className="text-xs text-accent-500">{errors.parentPhone}</p>
        )}
      </div>

      {generalError && (
        <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {generalError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-navy-500 to-navy-700 px-6 py-3 text-sm font-semibold text-pastel-50 disabled:pointer-events-none disabled:opacity-70"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        Lưu và gửi duyệt
      </button>
    </form>
  );
}
