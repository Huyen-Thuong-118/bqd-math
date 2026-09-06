import Link from "next/link";
import { notFound } from "next/navigation";

import { requireActiveAdminId } from "@/features/exams/admin";
import { PdfViewer } from "@/features/exams/components/PdfViewer";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ExamPreviewPage({ params }: { params: Promise<{ examId: string }> }) {
  await requireActiveAdminId();
  const { examId } = await params;
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { id: true, title: true, mode: true, durationMinutes: true, allowDownload: true, examFileUrl: true, questions: { select: { id: true, number: true, type: true, content: true, options: true }, orderBy: { number: "asc" } } } });
  if (!exam) notFound();
  return (
    <section className="space-y-5">
      <Link href="/admin/de-thi" className="text-sm font-semibold text-navy-400">← Danh sách đề</Link>
      <div><p className="text-xs font-semibold uppercase tracking-wide text-navy-300">Xem trước giao diện học sinh · {exam.mode === "MOCK" ? `${exam.durationMinutes ?? "—"} phút` : "Không giới hạn giờ"}</p><h1 className="mt-1 text-2xl font-semibold text-navy-600">{exam.title}</h1></div>
      <div className={exam.examFileUrl ? "grid gap-5 xl:grid-cols-[1.2fr_.8fr]" : "mx-auto max-w-4xl"}>
        {exam.examFileUrl && <PdfViewer title="Đề thi" fileUrl={`/api/exams/${exam.id}/file/exam`} allowDownload={exam.allowDownload} watermark="BẢN XEM TRƯỚC · GIÁO VIÊN" unavailableMessage="Không thể mở file đề." />}
        <section className="rounded-3xl border border-navy-100 bg-white p-5">
          <h2 className="font-semibold text-navy-600">Nội dung và phiếu trả lời ({exam.questions.length} câu)</h2>
          <div className="mt-4 space-y-4">
            {exam.questions.map((question) => {
              const options = Array.isArray(question.options) ? question.options.filter((value): value is string => typeof value === "string") : [];
              return <article key={question.id} className="rounded-2xl bg-pastel-50 p-4"><p className="whitespace-pre-wrap text-sm font-semibold text-navy-600">Câu {question.number}. {question.content}</p>{question.type === "MULTIPLE_CHOICE" ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{options.map((option, index) => <span key={index} className="rounded-lg border border-navy-100 bg-white px-3 py-2 text-xs text-navy-500"><strong>{String.fromCharCode(65 + index)}.</strong> {option}</span>)}</div> : question.type === "TRUE_FALSE" ? <div className="mt-2 space-y-2">{options.map((option, index) => <span key={index} className="block rounded-lg border border-navy-100 bg-white px-3 py-2 text-xs text-navy-500">{String.fromCharCode(97 + index)}) {option} · Đ / S</span>)}</div> : <div className="mt-2 h-10 rounded-lg border border-navy-100 bg-white" />}</article>;
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
