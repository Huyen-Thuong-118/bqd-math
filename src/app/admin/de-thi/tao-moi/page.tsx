import { ExamCreateForm } from "@/features/exams/components/ExamCreateForm";
import { ExamFromBankForm } from "@/features/exams/components/ExamFromBankForm";
import { db } from "@/lib/db";
import { isCloudStorageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function CreateExamPage() {
  const [classes, questionRows] = await Promise.all([db.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, level: true }, orderBy: { createdAt: "desc" } }), db.reviewQuestion.findMany({ select: { id: true, content: true, type: true, topic: true, chapter: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 })]);
  const questions = questionRows.map((item) => ({ id: item.id, content: item.content, type: item.type, topic: item.topic, chapter: item.chapter.name }));
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div><h1 className="text-xl font-semibold text-navy-600">Tạo đề mới</h1><p className="mt-1 text-sm text-navy-300">Tải PDF, tạo phiếu tô, nhập đáp án và giao đề cho lớp.</p></div>
      <ExamCreateForm classes={classes} directUpload={isCloudStorageConfigured()} />
      <ExamFromBankForm classes={classes} questions={questions} />
    </section>
  );
}
