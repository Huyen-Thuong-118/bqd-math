import Link from "next/link";
import { notFound } from "next/navigation";

import { getStudentProgress, type ProgressFilters } from "@/features/progress/queries";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function score(value: number | null) {
  return value === null ? "—" : value.toFixed(2);
}

function queryHref(studentId: string, filters: ProgressFilters, page: number) {
  const query = new URLSearchParams();
  if (filters.classId) query.set("classId", filters.classId);
  query.set("range", filters.range);
  query.set("activity", filters.activity);
  query.set("page", String(page));
  return "/admin/hoc-sinh/" + studentId + "/ket-qua?" + query.toString();
}

export default async function StudentProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { studentId } = await params;
  const raw = await searchParams;
  const rangeValue = first(raw.range);
  const activityValue = first(raw.activity);
  const filters: ProgressFilters = {
    classId: first(raw.classId),
    range: rangeValue === "30" || rangeValue === "all" ? rangeValue : "90",
    activity: activityValue === "exam" || activityValue === "review" ? activityValue : "all",
    page: Math.max(1, Math.min(10_000, Number.parseInt(first(raw.page), 10) || 1)),
  };
  const data = await getStudentProgress(studentId, filters);
  if (!data) notFound();
  const summary = data.summary;
  const status = data.student.status === "ACTIVE" ? "Đang hoạt động" : data.student.status === "PENDING" ? "Chờ duyệt" : "Đã đình chỉ";

  return (
    <section className="space-y-6">
      <div>
        <Link href="/admin/hoc-sinh" className="text-sm font-semibold text-navy-400">← Quản lý học sinh</Link>
        <div className="mt-3 rounded-3xl bg-linear-to-br from-navy-600 to-navy-800 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-pastel-200">Hồ sơ kết quả học tập</p>
          <h1 className="mt-1 text-2xl font-semibold">{data.student.name}</h1>
          <p className="mt-2 text-sm text-pastel-100">{data.student.studentCode ?? "Chưa có mã"} · {data.student.email} · {status}</p>
          <p className="mt-1 text-xs text-pastel-200">Lớp: {data.student.classes.map((item) => item.code + " · " + item.name).join(", ") || "Chưa xếp lớp"}</p>
        </div>
      </div>

      <form method="get" className="grid gap-3 rounded-3xl border border-navy-100 bg-white p-4 sm:grid-cols-3">
        <label className="text-xs text-navy-400">Lớp<select name="classId" defaultValue={data.selectedClassId} className="mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm"><option value="">Tất cả lớp</option>{data.student.classes.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label className="text-xs text-navy-400">Khoảng thời gian<select name="range" defaultValue={filters.range} className="mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm"><option value="30">30 ngày</option><option value="90">90 ngày</option><option value="all">Toàn bộ</option></select></label>
        <label className="text-xs text-navy-400">Hoạt động<select name="activity" defaultValue={filters.activity} className="mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm"><option value="all">Đề thi và ôn tập</option><option value="exam">Chỉ đề thi</option><option value="review">Chỉ ôn tập</option></select></label>
        <button className="min-h-11 w-fit rounded-full bg-navy-600 px-5 py-2 text-sm font-semibold text-white sm:col-span-3">Áp dụng bộ lọc</button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Đề được giao" value={summary.assignedExams} />
        <Metric label="Đề đã làm" value={summary.completedExams} />
        <Metric label="Đề chưa làm" value={summary.pendingExams} />
        <Metric label="Lượt đã nộp" value={summary.submittedAttempts} />
        <Metric label="Điểm tốt nhất" value={score(summary.bestScore)} />
        <Metric label="Điểm gần nhất" value={score(summary.latestScore)} />
        <Metric label="Điểm trung bình" value={score(summary.averageScore)} />
        <Metric label="Câu ôn đúng" value={summary.reviewAttempts ? summary.reviewCorrect + "/" + summary.reviewAttempts : "—"} />
      </div>

      {summary.assignedExams === 0 ? (
        <p className="rounded-3xl border border-dashed border-navy-100 p-10 text-center text-sm text-navy-300">Học sinh chưa được giao đề trong phạm vi lớp đã chọn.</p>
      ) : summary.completedExams === 0 && summary.reviewAttempts === 0 ? (
        <p className="rounded-3xl border border-dashed border-amber-200 bg-amber-50 p-10 text-center text-sm text-amber-800">Đã được giao nội dung nhưng học sinh chưa hoàn thành hoạt động nào trong khoảng thời gian này.</p>
      ) : null}

      {data.trend.length > 0 && (
        <section className="rounded-3xl border border-navy-100 bg-white p-5">
          <h2 className="font-semibold text-navy-600">Xu hướng theo tuần</h2>
          <p className="mt-1 text-xs text-navy-300">Cột xanh: điểm đề trung bình (thang 10). Cột vàng: tỉ lệ câu ôn đúng.</p>
          <div className="mt-5 flex min-h-48 items-end gap-3 overflow-x-auto pb-2">
            {data.trend.map((item) => <div key={item.week} className="flex min-w-20 flex-1 flex-col items-center"><div className="flex h-36 items-end gap-1"><div title={"Điểm TB " + score(item.examAverage)} className="w-5 rounded-t bg-navy-500" style={{ height: String((item.examAverage ?? 0) * 10) + "%" }} /><div title={"Ôn đúng " + (item.reviewRate?.toFixed(0) ?? "—") + "%"} className="w-5 rounded-t bg-amber-400" style={{ height: String(item.reviewRate ?? 0) + "%" }} /></div><span className="mt-2 text-[10px] text-navy-300">{new Date(item.week).toLocaleDateString("vi-VN")}</span><span className="text-[10px] text-navy-400">{score(item.examAverage)} · {item.reviewRate === null ? "—" : item.reviewRate.toFixed(0) + "%"}</span></div>)}
          </div>
        </section>
      )}

      {filters.activity !== "review" && (
        <section className="overflow-hidden rounded-3xl border border-navy-100 bg-white">
          <div className="p-5"><h2 className="font-semibold text-navy-600">Kết quả theo đề</h2></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-pastel-50 text-xs text-navy-400"><tr><th className="p-3">Đề</th><th className="p-3">Lớp</th><th className="p-3">Lượt</th><th className="p-3">Tốt nhất</th><th className="p-3">Gần nhất</th><th className="p-3">Trung bình</th><th className="p-3" /></tr></thead><tbody className="divide-y divide-navy-50">{data.examSummaries.map((exam) => <tr key={exam.id}><td className="p-3 font-medium text-navy-600">{exam.title}</td><td className="p-3 text-navy-400">{exam.examLinks.map((item) => item.class.code).join(", ")}</td><td className="p-3">{exam.attempts}</td><td className="p-3">{score(exam.bestScore)}</td><td className="p-3">{score(exam.latestScore)}</td><td className="p-3">{score(exam.averageScore)}</td><td className="p-3"><Link href={"/admin/de-thi/" + exam.id + "/thong-ke"} className="font-semibold text-navy-500 underline">Mở đề</Link></td></tr>)}</tbody></table></div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {filters.activity !== "review" && <section className="rounded-3xl border border-navy-100 bg-white p-5"><h2 className="font-semibold text-navy-600">Lịch sử nộp bài</h2><div className="mt-3 space-y-2">{data.examHistory.map((attempt) => <article key={attempt.id} className="rounded-2xl bg-pastel-50 p-3 text-sm"><div className="flex justify-between gap-3"><strong className="text-navy-600">{attempt.exam.title}</strong><strong className="text-navy-600">{score(attempt.score)}</strong></div><p className="mt-1 text-xs text-navy-300">{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString("vi-VN") : "—"} · {attempt.correctCount ?? 0} đúng · {attempt.incorrectCount ?? 0} sai · {attempt.unansweredCount ?? 0} bỏ trống</p></article>)}{!data.examHistory.length && <p className="py-8 text-center text-sm text-navy-300">Chưa có lượt nộp.</p>}</div>{data.pagination.totalPages > 1 && <div className="mt-4 flex items-center justify-center gap-3"><Link aria-disabled={filters.page <= 1} href={queryHref(studentId, filters, Math.max(1, filters.page - 1))} className="rounded-full border border-navy-100 px-3 py-2 text-xs font-semibold text-navy-500">← Trước</Link><span className="text-xs text-navy-300">{filters.page}/{data.pagination.totalPages}</span><Link aria-disabled={filters.page >= data.pagination.totalPages} href={queryHref(studentId, filters, Math.min(data.pagination.totalPages, filters.page + 1))} className="rounded-full border border-navy-100 px-3 py-2 text-xs font-semibold text-navy-500">Sau →</Link></div>}</section>}
        {filters.activity !== "exam" && <section className="rounded-3xl border border-navy-100 bg-white p-5"><h2 className="font-semibold text-navy-600">Ôn tập theo chương</h2><div className="mt-3 space-y-3">{data.reviewByChapter.map((chapter) => <div key={chapter.id}><div className="flex justify-between text-sm text-navy-500"><span>{chapter.name}</span><strong>{chapter.correct}/{chapter.attempts} · {(chapter.correct / chapter.attempts * 100).toFixed(0)}%</strong></div><div className="mt-1 h-2 rounded-full bg-pastel-100"><div className="h-full rounded-full bg-amber-400" style={{ width: String(chapter.correct / chapter.attempts * 100) + "%" }} /></div></div>)}{!data.reviewByChapter.length && <p className="py-8 text-center text-sm text-navy-300">Chưa có lượt ôn tập.</p>}</div></section>}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-navy-100 bg-white p-4"><p className="text-2xl font-bold text-navy-600">{value}</p><p className="mt-1 text-xs text-navy-300">{label}</p></div>;
}
