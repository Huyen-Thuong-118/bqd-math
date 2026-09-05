import { Clock3, FileQuestion, Medal } from "lucide-react";

import type { ExamListItem } from "../types";
import { StartExamButton } from "./StartExamButton";

export function ExamList({ exams }: { exams: ExamListItem[] }) {
  if (exams.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-navy-200 bg-white/70 px-6 py-16 text-center">
        <FileQuestion className="mx-auto size-10 text-navy-300" aria-hidden />
        <p className="mt-3 text-sm text-navy-400">Bạn chưa được giao đề thi nào.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {exams.map((exam) => {
        const limitReached =
          !exam.openAttemptId &&
          exam.maxAttempts !== null &&
          exam.attemptCount >= exam.maxAttempts;
        return (
          <article
            key={exam.id}
            className="flex flex-col justify-between gap-5 rounded-3xl border border-navy-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-pastel-100 px-3 py-1 text-xs font-semibold text-navy-500">
                  {exam.mode === "MOCK" ? "Thi thử" : "Luyện tập"}
                </span>
                <span className="text-xs text-navy-300">{exam.availabilityLabel}</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-navy-600">{exam.title}</h2>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-navy-400">
                <span className="inline-flex items-center gap-1.5">
                  <FileQuestion className="size-4" aria-hidden />
                  {exam.questionCount} câu
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-4" aria-hidden />
                  {exam.durationMinutes ? `${exam.durationMinutes} phút` : "Không giới hạn"}
                </span>
                <span>
                  Lượt làm: {exam.attemptCount}
                  {exam.maxAttempts === null ? " / không giới hạn" : ` / ${exam.maxAttempts}`}
                </span>
                {exam.bestScore !== null && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600">
                    <Medal className="size-4" aria-hidden />
                    Cao nhất {exam.bestScore.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <StartExamButton
              examId={exam.id}
              disabled={!exam.available || limitReached || exam.questionCount === 0}
              resume={Boolean(exam.openAttemptId)}
            />
          </article>
        );
      })}
    </div>
  );
}
