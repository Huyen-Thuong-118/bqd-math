import Link from "next/link";
import { BookOpen, ChartNoAxesColumnIncreasing } from "lucide-react";

import { getReviewChaptersForCurrentStudent } from "@/features/review-questions/queries";

export const dynamic = "force-dynamic";

export default async function ReviewChapterListPage() {
  const chapters = await getReviewChaptersForCurrentStudent();
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold text-navy-600">Câu hỏi ôn tập</h1>
      <p className="-mt-4 text-sm text-navy-400">Luyện từng câu và xem tiến độ của bạn theo chương.</p>
      {chapters.length ? <div className="grid gap-4 md:grid-cols-2">{chapters.map((chapter) => <Link key={chapter.id} href={`/on-tap/${chapter.id}`} className="rounded-3xl border border-navy-100 bg-white p-5 shadow-sm transition hover:shadow-md"><div className="flex items-start justify-between"><BookOpen className="size-7 text-navy-400" /><span className="rounded-full bg-pastel-100 px-3 py-1 text-xs font-semibold text-navy-500">{chapter.questionCount} câu</span></div><h2 className="mt-4 font-semibold text-navy-600">{chapter.name}</h2><p className="mt-2 flex items-center gap-1.5 text-sm text-navy-300"><ChartNoAxesColumnIncreasing className="size-4" />{chapter.attemptCount ? `${chapter.attemptCount} lượt · đúng ${chapter.correctRate}%` : "Chưa bắt đầu"}</p></Link>)}</div> : <div className="rounded-3xl border border-dashed border-navy-200 bg-white p-12 text-center text-sm text-navy-400">Bạn chưa được giao câu hỏi ôn tập nào.</div>}
    </section>
  );
}
