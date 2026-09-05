import type { Metadata } from "next";
import Link from "next/link";

import { AdminExamActions } from "@/features/exams/components/AdminExamActions";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Đề thi | BQD Math" };
export const dynamic = "force-dynamic";

export default async function AdminExamsPage() {
  const exams = await db.exam.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      mode: true,
      answerFileUrl: true,
      showAnswer: true,
      isForever: true,
      availableFrom: true,
      availableTo: true,
      allowDownload: true,
      examLinks: { select: { class: { select: { name: true } } } },
      _count: { select: { questions: true, attempts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-navy-600">Đề thi</h1><p className="mt-1 text-sm text-navy-300">Quản lý PDF, phiếu tô, thời gian và lời giải.</p></div>
        <Link href="/admin/de-thi/tao-moi" className="rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white">Tạo đề mới</Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {exams.map((exam) => (
          <article key={exam.id} className="rounded-3xl border border-navy-100 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-navy-300">{exam.mode === "MOCK" ? "Thi thử" : "Luyện tập"} · {exam.status === "DRAFT" ? "Bản nháp" : exam.status === "CLOSED" ? "Đã đóng" : "Đã xuất bản"}</p><h2 className="mt-1 font-semibold text-navy-600">{exam.title}</h2></div>
              <span className="rounded-full bg-pastel-50 px-3 py-1 text-xs text-navy-400">{exam._count.questions} câu</span>
            </div>
            <p className="mt-3 text-sm text-navy-400">Lớp: {exam.examLinks.map((link) => link.class.name).join(", ") || "Chưa giao"}</p>
            <p className="mt-1 text-xs text-navy-300">{exam.isForever ? "Mở vĩnh viễn" : `${exam.availableFrom?.toLocaleString("vi-VN") ?? "—"} → ${exam.availableTo?.toLocaleString("vi-VN") ?? "—"}`} · {exam._count.attempts} lượt làm · {exam.allowDownload ? "Cho tải" : "Không cho tải"}</p>
            <div className="mt-3 flex flex-wrap gap-3"><Link href={`/admin/de-thi/${exam.id}/chinh-sua`} className="text-xs font-semibold text-navy-600 underline">Chỉnh sửa</Link><a href={`/api/exams/${exam.id}/file/exam`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-navy-500 underline">Xem đề</a>{exam.answerFileUrl && <a href={`/api/exams/${exam.id}/file/solution`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-navy-500 underline">Xem lời giải</a>}<Link href={`/admin/de-thi/${exam.id}/xem-truoc`} className="text-xs font-semibold text-navy-500 underline">Xem trước như học sinh</Link><Link href={`/admin/de-thi/${exam.id}/thong-ke`} className="text-xs font-semibold text-navy-500 underline">Thống kê & CSV</Link></div>
            <AdminExamActions examId={exam.id} hasSolution={Boolean(exam.answerFileUrl)} showAnswer={exam.showAnswer} status={exam.status} />
          </article>
        ))}
      </div>
      {exams.length === 0 && <div className="rounded-3xl border border-dashed border-navy-100 p-10 text-center text-sm text-navy-300">Chưa có đề nào. Hãy tạo đề đầu tiên.</div>}
    </section>
  );
}
