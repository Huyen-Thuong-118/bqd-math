import type { Metadata } from "next";

import { AdminReviewManager } from "@/features/review-questions/components/AdminReviewManager";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Câu hỏi ôn tập | BQD Math",
};

export const dynamic = "force-dynamic";

export default async function AdminReviewQuestionsPage() {
  const [chapters, classes, rows] = await Promise.all([
    db.chapter.findMany({ select: { id: true, name: true, order: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    db.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.reviewQuestion.findMany({
      select: { id: true, chapterId: true, content: true, type: true, options: true, correctAnswer: true, grade: true, topic: true, difficulty: true, textSolution: true, solutionImageUrl: true, videoUid: true, showSolution: true, classLinks: { select: { classId: true, class: { select: { name: true } } } }, attempts: { select: { isCorrect: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const questions = rows.map((item) => ({ ...item, options: Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === "string") : [], classIds: item.classLinks.map((link) => link.classId), classNames: item.classLinks.map((link) => link.class.name), classLinks: undefined, attempts: item.attempts.length, correctRate: item.attempts.length ? Math.round(item.attempts.filter((attempt) => attempt.isCorrect).length / item.attempts.length * 100) : null }));
  return (
    <section className="space-y-5">
      <h1 className="text-xl font-semibold text-navy-600">Câu hỏi ôn tập</h1>
      <p className="-mt-4 text-sm text-navy-300">Tổ chức theo chương/chủ đề, tái sử dụng cho nhiều lớp và theo dõi tỷ lệ đúng.</p>
      <AdminReviewManager chapters={chapters} classes={classes} questions={questions} />
    </section>
  );
}
