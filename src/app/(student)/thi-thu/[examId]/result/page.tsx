import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, CircleX, MinusCircle, Trophy } from "lucide-react";

import { getExamResult } from "@/features/exams/queries";
import { PdfViewer } from "@/features/exams/components/PdfViewer";

export const dynamic = "force-dynamic";

export default async function ExamResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ attemptId?: string | string[] }>;
}) {
  const { examId } = await params;
  const query = await searchParams;
  const attemptId =
    typeof query.attemptId === "string" ? query.attemptId : undefined;
  if (!attemptId) redirect("/thi-thu");

  const result = await getExamResult(examId, attemptId);
  if (!result) notFound();

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-linear-to-br from-navy-600 to-navy-800 p-6 text-white sm:p-8">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Trophy className="size-10 text-amber-300" aria-hidden />
          </div>
          <div className="flex-1">
            <p className="text-sm text-pastel-200">Kết quả bài thi</p>
            <h1 className="mt-1 text-2xl font-semibold">{result.examTitle}</h1>
            <p className="mt-3 text-4xl font-bold">{result.score.toFixed(2)} / 10</p>
          </div>
          <Link
            href="/thi-thu"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy-600"
          >
            Về danh sách đề
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={CheckCircle2} label="Đúng" value={result.correctCount} color="text-green-600" />
        <SummaryCard icon={CircleX} label="Sai" value={result.incorrectCount} color="text-red-600" />
        <SummaryCard icon={MinusCircle} label="Bỏ trống" value={result.unansweredCount} color="text-amber-600" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PdfViewer
          title="Đề thi"
          fileUrl={result.hasExamFile ? `/api/exams/${result.examId}/file/exam` : undefined}
          allowDownload={result.allowDownload}
          watermark={result.examTitle}
          unavailableMessage="Đề demo không có file PDF."
        />
        <PdfViewer
          title="Lời giải"
          muted
          fileUrl={
            result.hasAnswerFile && result.showAnswer
              ? `/api/exams/${result.examId}/file/solution`
              : undefined
          }
          allowDownload={result.allowDownload}
          watermark={result.examTitle}
          unavailableMessage={
            result.hasAnswerFile
              ? "Giáo viên đang ẩn lời giải."
              : "Đề chưa có file lời giải."
          }
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-navy-600">Chi tiết đáp án</h2>
        {result.questions.map((question) => (
          <article
            key={question.questionNumber}
            className={`rounded-3xl border bg-white p-5 ${question.isCorrect ? "border-green-200" : "border-red-200"}`}
          >
            <div className="flex items-start gap-3">
              {question.isCorrect ? (
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-green-600" aria-hidden />
              ) : (
                <CircleX className="mt-0.5 size-6 shrink-0 text-red-600" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-navy-600">
                  Câu {question.questionNumber}. {question.content}
                </p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <p className="rounded-xl bg-pastel-50 px-3 py-2 text-navy-400">
                    Bạn chọn: <strong>{question.selectedAnswer ?? "Bỏ trống"}</strong>
                  </p>
                  <p className="rounded-xl bg-pastel-50 px-3 py-2 text-navy-400">
                    Đáp án đúng: <strong>{question.correctAnswer ?? "Đang được ẩn"}</strong>
                  </p>
                </div>
                {question.explanation && (
                  <p className="mt-3 text-sm leading-relaxed text-navy-400">
                    <strong className="text-navy-500">Giải thích:</strong>{" "}
                    {question.explanation}
                  </p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4 text-center">
      <Icon className={`mx-auto size-5 ${color}`} aria-hidden />
      <p className="mt-2 text-2xl font-semibold text-navy-600">{value}</p>
      <p className="text-xs text-navy-300">{label}</p>
    </div>
  );
}
