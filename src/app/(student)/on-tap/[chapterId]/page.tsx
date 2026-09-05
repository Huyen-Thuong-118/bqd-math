import Link from "next/link";

import { ReviewPractice } from "@/features/review-questions/components/ReviewPractice";
import { getReviewQuestionsForCurrentStudent } from "@/features/review-questions/queries";

export const dynamic = "force-dynamic";

export default async function ReviewQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ chapterId: string }>;
  searchParams: Promise<{ q?: string | string[]; difficulty?: string | string[] }>;
}) {
  const { chapterId } = await params;
  const search = await searchParams;
  const q = typeof search.q === "string" ? search.q.trim() : "";
  const difficulty = typeof search.difficulty === "string" ? search.difficulty : "";
  const { chapter, questions } = await getReviewQuestionsForCurrentStudent(chapterId, { q, difficulty });
  return (
    <section className="space-y-5">
      <Link href="/on-tap" className="text-sm font-semibold text-navy-400">← Các chương</Link>
      <h1 className="text-2xl font-semibold text-navy-600">{chapter.name}</h1>
      <form className="grid gap-3 rounded-2xl border border-navy-100 bg-white p-4 sm:grid-cols-[1fr_12rem_auto]"><input name="q" defaultValue={q} className="rounded-xl border border-navy-100 px-3 py-2 text-sm outline-none focus:border-navy-400" placeholder="Tìm nội dung hoặc chủ đề…" /><select name="difficulty" defaultValue={difficulty} className="rounded-xl border border-navy-100 px-3 py-2 text-sm text-navy-500"><option value="">Mọi độ khó</option><option value="EASY">Dễ</option><option value="MEDIUM">Trung bình</option><option value="HARD">Khó</option></select><button className="rounded-full bg-navy-600 px-5 py-2 text-sm font-semibold text-white">Lọc</button></form>
      <ReviewPractice questions={questions} />
    </section>
  );
}
