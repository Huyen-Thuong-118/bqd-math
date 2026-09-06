import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";

import { AdminExamActions } from "@/features/exams/components/AdminExamActions";
import { ExamFolderManager } from "@/features/exams/components/ExamFolderManager";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Đề thi | BQD Math" };
export const dynamic = "force-dynamic";

function folderOptions(rows: { id: string; name: string; parentId: string | null; position: number; _count: { children: number; exams: number } }[]) {
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
    return { id: row.id, name: row.name, parentId: row.parentId, position: row.position, count: row._count.children + row._count.exams, label: names.join(" / ") };
  }).sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

function param(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function AdminExamsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q = param(raw.q).slice(0, 100);
  const status = ["DRAFT", "PUBLISHED", "CLOSED"].includes(param(raw.status)) ? param(raw.status) : "";
  const mode = ["MOCK", "PRACTICE"].includes(param(raw.mode)) ? param(raw.mode) : "";
  const classId = param(raw.classId);
  const folderId = param(raw.folderId);
  const where: Prisma.ExamWhereInput = {
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(status ? { status: status as "DRAFT" | "PUBLISHED" | "CLOSED" } : {}),
    ...(mode ? { mode: mode as "MOCK" | "PRACTICE" } : {}),
    ...(classId ? { examLinks: { some: { classId } } } : {}),
    ...(folderId === "root" ? { folderId: null } : folderId ? { folderId } : {}),
  };
  const [exams, treeExams, folderRows, classes] = await Promise.all([
    db.exam.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        mode: true,
        folderId: true,
        position: true,
        examFileUrl: true,
        answerFileUrl: true,
        showAnswer: true,
        isForever: true,
        availableFrom: true,
        availableTo: true,
        allowDownload: true,
        examLinks: { select: { class: { select: { name: true } } } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.exam.findMany({ select: { id: true, title: true, folderId: true, position: true, _count: { select: { questions: true } } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.folder.findMany({
      where: { kind: "EXAM" },
      select: { id: true, name: true, parentId: true, position: true, _count: { select: { children: true, exams: true } } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    db.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);
  const folders = folderOptions(folderRows);
  const folderLabel = new Map(folders.map((folder) => [folder.id, folder.label]));

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-navy-600">Đề thi</h1><p className="mt-1 text-sm text-navy-300">Quản lý PDF, phiếu tô, thời gian và lời giải.</p></div>
        <Link href="/admin/de-thi/tao-moi" className="rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white">Tạo đề mới</Link>
      </div>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,2fr)]">
        <div className="min-w-0 xl:sticky xl:top-5"><ExamFolderManager
          folders={folders}
          exams={treeExams.map((exam) => ({ id: exam.id, title: exam.title, folderId: exam.folderId, position: exam.position, meta: `${exam._count.questions} câu` }))}
        /></div>
        <div className="min-w-0 space-y-4">
          <form method="get" className="grid gap-3 rounded-3xl border border-navy-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-navy-400 sm:col-span-2">Tìm theo tên<input name="q" defaultValue={q} maxLength={100} placeholder="Nhập tên đề…" className="mt-1 w-full rounded-xl border border-navy-100 px-3 py-2.5 text-sm outline-none focus:border-navy-400" /></label>
            <label className="text-xs text-navy-400">Trạng thái<select name="status" defaultValue={status} className="mt-1 w-full rounded-xl border border-navy-100 px-3 py-2.5 text-sm"><option value="">Tất cả</option><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đã xuất bản</option><option value="CLOSED">Đã đóng</option></select></label>
            <label className="text-xs text-navy-400">Chế độ<select name="mode" defaultValue={mode} className="mt-1 w-full rounded-xl border border-navy-100 px-3 py-2.5 text-sm"><option value="">Tất cả</option><option value="MOCK">Thi thử</option><option value="PRACTICE">Luyện tập</option></select></label>
            <label className="text-xs text-navy-400">Lớp<select name="classId" defaultValue={classId} className="mt-1 w-full rounded-xl border border-navy-100 px-3 py-2.5 text-sm"><option value="">Tất cả</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
            <label className="text-xs text-navy-400">Thư mục<select name="folderId" defaultValue={folderId} className="mt-1 w-full rounded-xl border border-navy-100 px-3 py-2.5 text-sm"><option value="">Tất cả</option><option value="root">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3"><button className="rounded-full bg-navy-600 px-4 py-2.5 text-xs font-semibold text-white">Lọc đề</button><Link href="/admin/de-thi" className="rounded-full border border-navy-100 px-4 py-2.5 text-xs font-semibold text-navy-500">Xóa lọc</Link><span className="ml-auto text-xs text-navy-300">{exams.length} kết quả</span></div>
          </form>
          <div className="grid gap-4 lg:grid-cols-2">
        {exams.map((exam) => (
          <article key={exam.id} className="rounded-3xl border border-navy-100 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs text-navy-300">📁 {exam.folderId ? folderLabel.get(exam.folderId) ?? "Thư mục đã xóa" : "Thư mục gốc"}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-navy-300">{exam.mode === "MOCK" ? "Thi thử" : "Luyện tập"} · {exam.status === "DRAFT" ? "Bản nháp" : exam.status === "CLOSED" ? "Đã đóng" : "Đã xuất bản"}</p><h2 className="mt-1 font-semibold text-navy-600">{exam.title}</h2></div>
              <span className="rounded-full bg-pastel-50 px-3 py-1 text-xs text-navy-400">{exam._count.questions} câu</span>
            </div>
            <p className="mt-3 text-sm text-navy-400">Lớp: {exam.examLinks.map((link) => link.class.name).join(", ") || "Chưa giao"}</p>
            <p className="mt-1 text-xs text-navy-300">{exam.isForever ? "Mở vĩnh viễn" : `${exam.availableFrom?.toLocaleString("vi-VN") ?? "—"} → ${exam.availableTo?.toLocaleString("vi-VN") ?? "—"}`} · {exam._count.attempts} lượt làm · {exam.allowDownload ? "Cho tải" : "Không cho tải"}</p>
            <div className="mt-3 flex flex-wrap gap-3"><Link href={`/admin/de-thi/${exam.id}/chinh-sua`} className="text-xs font-semibold text-navy-600 underline">Chỉnh sửa</Link>{exam.examFileUrl && <a href={`/api/exams/${exam.id}/file/exam`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-navy-500 underline">Xem đề</a>}{exam.answerFileUrl && <a href={`/api/exams/${exam.id}/file/solution`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-navy-500 underline">Xem lời giải</a>}<Link href={`/admin/de-thi/${exam.id}/xem-truoc`} className="text-xs font-semibold text-navy-500 underline">Xem trước như học sinh</Link><Link href={`/admin/de-thi/${exam.id}/thong-ke`} className="text-xs font-semibold text-navy-500 underline">Thống kê & CSV</Link></div>
            <AdminExamActions examId={exam.id} hasSolution={Boolean(exam.answerFileUrl)} showAnswer={exam.showAnswer} status={exam.status} />
          </article>
        ))}
          </div>
          {exams.length === 0 && <div className="rounded-3xl border border-dashed border-navy-100 p-10 text-center text-sm text-navy-300">Không có đề phù hợp với bộ lọc.</div>}
        </div>
      </div>
    </section>
  );
}
