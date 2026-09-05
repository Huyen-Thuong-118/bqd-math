"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

import { startExam } from "../actions";

export function StartExamButton({
  examId,
  disabled,
  resume,
}: {
  examId: string;
  disabled: boolean;
  resume: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleStart() {
    setIsPending(true);
    setError(undefined);
    const result = await startExam(examId);
    if (!result.success) {
      setError(result.error);
      setIsPending(false);
      return;
    }

    const path = result.submitted
      ? `/thi-thu/${examId}/result?attemptId=${result.attemptId}`
      : `/thi-thu/${examId}?attemptId=${result.attemptId}`;
    router.push(path);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={disabled || isPending}
        onClick={handleStart}
        className="inline-flex items-center gap-2 rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:pointer-events-none disabled:opacity-45"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Play className="size-4" aria-hidden />
        )}
        {resume ? "Tiếp tục làm" : "Bắt đầu"}
      </button>
      {error && <p className="max-w-56 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
