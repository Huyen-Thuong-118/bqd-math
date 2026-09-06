import type { Metadata } from "next";

import { AdminReviewManager } from "@/features/review-questions/components/AdminReviewManager";
import {
  AdminReviewQuestionFilters,
  ReviewQuestionPagination,
} from "@/features/review-questions/components/ReviewQuestionFilters";
import { parseReviewQuestionFilters } from "@/features/review-questions/filters";
import { getAdminReviewQuestionsPage } from "@/features/review-questions/queries";

export const metadata: Metadata = {
  title: "Câu hỏi ôn tập | BQD Math",
};

export const dynamic = "force-dynamic";

export default async function AdminReviewQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseReviewQuestionFilters(await searchParams, { allowSolution: true });
  const { chapters, classes, questions, pagination } = await getAdminReviewQuestionsPage(filters);
  return (
    <section className="space-y-5">
      <h1 className="text-xl font-semibold text-navy-600">Câu hỏi ôn tập</h1>
      <p className="-mt-4 text-sm text-navy-300">Tổ chức theo chương/chủ đề, tái sử dụng cho nhiều lớp và theo dõi tỷ lệ đúng.</p>
      <AdminReviewQuestionFilters filters={filters} chapters={chapters} classes={classes} total={pagination.total} />
      <AdminReviewManager chapters={chapters} classes={classes} questions={questions} />
      <ReviewQuestionPagination pathname="/admin/cau-hoi-on-tap" filters={filters} page={pagination.page} totalPages={pagination.totalPages} />
    </section>
  );
}
