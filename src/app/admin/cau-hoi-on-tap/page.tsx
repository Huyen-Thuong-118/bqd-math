import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

import { AdminPlaceholder } from "@/components/layout/AdminPlaceholder";

export const metadata: Metadata = {
  title: "Câu hỏi ôn tập | BQD Math",
};

// Stub — model Chapter/ReviewQuestion đã có sẵn trong schema, đủ dữ liệu để
// dựng UI thật ở prompt sau.
export default function AdminReviewQuestionsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-navy-600">Câu hỏi ôn tập</h1>
      <AdminPlaceholder
        icon={BookOpen}
        description="Ngân hàng câu hỏi ôn tập theo chương, dùng lại cho nhiều lớp."
      />
    </section>
  );
}
