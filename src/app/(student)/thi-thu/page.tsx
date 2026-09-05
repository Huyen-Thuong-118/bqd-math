import type { Metadata } from "next";

import { ExamList } from "@/features/exams/components/ExamList";
import { getExamListForCurrentStudent } from "@/features/exams/queries";

export const metadata: Metadata = { title: "Phòng thi thử | BQD Math" };
export const dynamic = "force-dynamic";

export default async function ExamListPage() {
  const exams = await getExamListForCurrentStudent();
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-navy-600">Phòng thi thử</h1>
        <p className="mt-1 text-sm text-navy-400">
          Các đề được giao cho lớp của bạn. Đáp án được tự động lưu khi làm bài.
        </p>
      </div>
      <ExamList exams={exams} />
    </section>
  );
}
