import { ExamCreateForm } from "@/features/exams/components/ExamCreateForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CreateExamPage() {
  const classes = await db.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, level: true }, orderBy: { createdAt: "desc" } });
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div><h1 className="text-xl font-semibold text-navy-600">Tạo đề mới</h1><p className="mt-1 text-sm text-navy-300">Tải PDF, tạo phiếu tô, nhập đáp án và giao đề cho lớp.</p></div>
      <ExamCreateForm classes={classes} />
    </section>
  );
}
