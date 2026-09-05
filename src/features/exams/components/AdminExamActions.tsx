"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeExam, publishExam, toggleExamSolution } from "../admin-actions";

export function AdminExamActions({ examId, hasSolution, showAnswer, status }: { examId: string; hasSolution: boolean; showAnswer: boolean; status: "DRAFT" | "PUBLISHED" | "CLOSED" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  function run(action: () => Promise<{ success: true } | { success: false; error: string }>) {
    setError(undefined);
    startTransition(async () => { const result = await action(); if (!result.success) setError(result.error); else router.refresh(); });
  }
  return <div className="mt-3 flex flex-wrap items-center gap-2">{status !== "PUBLISHED" && <button type="button" disabled={pending} onClick={() => run(() => publishExam(examId))} className="rounded-full border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700 disabled:opacity-40">Xuất bản</button>}<button type="button" disabled={pending || !hasSolution} onClick={() => run(() => toggleExamSolution(examId))} className="rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-400 disabled:opacity-40">{showAnswer ? "Ẩn lời giải" : "Mở lời giải"}</button>{status === "PUBLISHED" && <button type="button" disabled={pending} onClick={() => run(() => closeExam(examId))} className="rounded-full border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40">Đóng đề ngay</button>}{error && <span className="text-xs text-red-600">{error}</span>}</div>;
}
