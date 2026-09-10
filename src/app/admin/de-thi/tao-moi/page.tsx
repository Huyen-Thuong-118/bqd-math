import { ExamCreateForm } from "@/features/exams/components/ExamCreateForm";
import { ExamFromBankForm } from "@/features/exams/components/ExamFromBankForm";
import { ManualExamForm } from "@/features/exams/components/ManualExamForm";
import { parseReviewQuestionFilters } from "@/features/review-questions/filters";
import { getQuestionBankPage } from "@/features/review-questions/queries";
import { db } from "@/lib/db";
import { isCloudStorageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

function folderOptions(rows: { id: string; name: string; parentId: string | null }[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => {
    const names = [row.name];
    let parentId = row.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parent.parentId;
    }
    return { id: row.id, label: names.join(" / ") };
  }).sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

export default async function CreateExamPage() {
  const [classes, chapters, bank, folderRows] = await Promise.all([
    db.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true, level: true }, orderBy: { createdAt: "desc" } }),
    db.chapter.findMany({ select: { id: true, name: true, order: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    getQuestionBankPage(parseReviewQuestionFilters({})),
    db.folder.findMany({ where: { kind: "EXAM" }, select: { id: true, name: true, parentId: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);
  const folders = folderOptions(folderRows);
  const directUpload = isCloudStorageConfigured();
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div><h1 className="text-xl font-semibold text-navy-600">Tạo đề mới</h1><p className="mt-1 text-sm text-navy-300">Tải PDF, tạo phiếu tô, nhập đáp án và giao đề cho lớp.</p></div>
      <div><h2 className="mb-3 font-semibold text-navy-600">1. Upload PDF</h2><ExamCreateForm classes={classes} folders={folders} directUpload={directUpload} storageWarning={!directUpload && process.env.NODE_ENV === "production"} /></div>
      <ExamFromBankForm classes={classes} folders={folders} chapters={chapters} initialQuestions={bank.questions} initialPagination={bank.pagination} />
      <ManualExamForm classes={classes} folders={folders} />
    </section>
  );
}
