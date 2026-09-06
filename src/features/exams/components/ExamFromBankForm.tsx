"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { searchQuestionBank } from "@/features/review-questions/actions";
import { createExamFromQuestionBank } from "../admin-actions";
import { InlineExamFolderCreator } from "./InlineExamFolderCreator";

type ClassOption = { id: string; name: string; code: string; level: string };
type FolderOption = { id: string; label: string };
type ChapterOption = { id: string; name: string; order: number };
type QuestionOption = {
  id: string;
  content: string;
  type: string;
  chapter: string;
  topic: string | null;
  grade: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
};
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
type BankFilters = {
  q: string;
  chapterId: string;
  type: string;
  difficulty: string;
  grade: string;
  classId: string;
};

const EMPTY_FILTERS: BankFilters = {
  q: "",
  chapterId: "",
  type: "",
  difficulty: "",
  grade: "",
  classId: "",
};
const input = "mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600 outline-none focus:border-navy-400";

export function ExamFromBankForm({
  classes,
  folders,
  chapters,
  initialQuestions,
  initialPagination,
}: {
  classes: ClassOption[];
  folders: FolderOption[];
  chapters: ChapterOption[];
  initialQuestions: QuestionOption[];
  initialPagination: Pagination;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [searching, startSearching] = useTransition();
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState("MOCK");
  const [filters, setFilters] = useState<BankFilters>(EMPTY_FILTERS);
  const [questions, setQuestions] = useState(initialQuestions);
  const [pagination, setPagination] = useState(initialPagination);
  const [selected, setSelected] = useState<Map<string, QuestionOption>>(new Map());

  function updateFilter(key: keyof BankFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function loadQuestions(page = 1, nextFilters = filters) {
    setError(undefined);
    startSearching(async () => {
      const result = await searchQuestionBank({ ...nextFilters, page: String(page) });
      if (!result.success) return setError(result.error);
      setQuestions(result.data.questions);
      setPagination(result.data.pagination);
    });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    loadQuestions(1, EMPTY_FILTERS);
  }

  function toggleQuestion(question: QuestionOption) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(question.id)) next.delete(question.id);
      else next.set(question.id, question);
      return next;
    });
  }

  function moveSelected(id: string, direction: -1 | 1) {
    setSelected((current) => {
      const items = [...current.values()];
      const index = items.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return current;
      [items[index], items[target]] = [items[target], items[index]];
      return new Map(items.map((item) => [item.id, item]));
    });
  }

  function submit(data: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await createExamFromQuestionBank(data);
      if (!result.success) return setError(result.error);
      router.push("/admin/de-thi");
      router.refresh();
    });
  }

  return (
    <details className="rounded-3xl border border-navy-100 bg-pastel-50 p-5">
      <summary className="cursor-pointer font-semibold text-navy-600">2. Tạo từ ngân hàng câu hỏi — không cần PDF</summary>
      <form action={submit} className="mt-5 space-y-5">
        {[...selected.keys()].map((id) => <input key={id} type="hidden" name="questionIds" value={id} />)}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-navy-500 sm:col-span-2">Tên đề<input className={input} name="title" required /></label>
          <label className="text-sm text-navy-500">Chế độ<select className={input} name="mode" value={mode} onChange={(event) => setMode(event.target.value)}><option value="MOCK">Thi thử</option><option value="PRACTICE">Luyện tập</option></select></label>
          <label className="text-sm text-navy-500">Thư mục<select className={input} name="folderId"><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label>
          <InlineExamFolderCreator folders={folders} />
          {mode === "MOCK" && <label className="text-sm text-navy-500">Thời lượng (phút)<input className={input} name="durationMinutes" type="number" min={1} defaultValue={45} required /></label>}
          <label className="text-sm text-navy-500">Số lượt tối đa<input className={input} name="maxAttempts" type="number" min={1} placeholder="Không giới hạn" /></label>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-green-800"><input name="publishNow" type="checkbox" defaultChecked /> Xuất bản ngay</label>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-navy-500">Giao cho lớp</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {classes.map((item) => <label key={item.id} className="rounded-xl bg-white px-3 py-2 text-xs text-navy-500"><input name="classIds" value={item.id} type="checkbox" /> {item.code} · {item.name} · {item.level === "ADVANCED" ? "Nâng cao" : "Cơ bản"}</label>)}
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <legend className="px-2 text-sm font-semibold text-navy-500">Chọn câu hỏi · đã chọn {selected.size}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-navy-400 sm:col-span-2">Tìm kiếm<input className={input} value={filters.q} onChange={(event) => updateFilter("q", event.target.value)} placeholder="Nội dung, chủ đề, chương…" /></label>
            <label className="text-xs text-navy-400">Chương<select className={input} value={filters.chapterId} onChange={(event) => updateFilter("chapterId", event.target.value)}><option value="">Mọi chương</option>{chapters.map((item) => <option key={item.id} value={item.id}>{item.order}. {item.name}</option>)}</select></label>
            <label className="text-xs text-navy-400">Loại câu<select className={input} value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}><option value="">Mọi loại</option><option value="MULTIPLE_CHOICE">Trắc nghiệm</option><option value="TRUE_FALSE">Đúng / Sai</option><option value="SHORT_ANSWER">Trả lời ngắn</option></select></label>
            <label className="text-xs text-navy-400">Độ khó<select className={input} value={filters.difficulty} onChange={(event) => updateFilter("difficulty", event.target.value)}><option value="">Mọi độ khó</option><option value="EASY">Dễ</option><option value="MEDIUM">Trung bình</option><option value="HARD">Khó</option></select></label>
            <label className="text-xs text-navy-400">Khối<input className={input} value={filters.grade} onChange={(event) => updateFilter("grade", event.target.value)} placeholder="Ví dụ: 12" /></label>
            <label className="text-xs text-navy-400">Lớp được giao<select className={input} value={filters.classId} onChange={(event) => updateFilter("classId", event.target.value)}><option value="">Mọi lớp</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={searching} onClick={() => loadQuestions()} className="rounded-full bg-navy-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{searching ? "Đang lọc…" : "Lọc câu hỏi"}</button>
            <button type="button" disabled={searching} onClick={clearFilters} className="rounded-full border border-navy-100 px-4 py-2 text-xs font-semibold text-navy-500">Xóa bộ lọc</button>
            <span className="ml-auto text-xs text-navy-300">{pagination.total} kết quả</span>
          </div>

          <div className="max-h-96 space-y-2 overflow-y-auto">
            {questions.map((item) => <label key={item.id} className="flex gap-2 rounded-xl bg-pastel-50 px-3 py-3 text-xs text-navy-500"><input className="mt-0.5" checked={selected.has(item.id)} onChange={() => toggleQuestion(item)} type="checkbox" /><span><strong>{item.chapter}{item.topic ? ` · ${item.topic}` : ""}{item.grade ? ` · Khối ${item.grade}` : ""}</strong><span className="mt-1 block line-clamp-2">{item.content}</span></span></label>)}
            {!questions.length && <p className="rounded-xl border border-dashed border-navy-100 p-6 text-center text-xs text-navy-300">Không có câu hỏi phù hợp.</p>}
          </div>

          {pagination.totalPages > 1 && <div className="flex items-center justify-center gap-3"><button type="button" disabled={searching || pagination.page <= 1} onClick={() => loadQuestions(pagination.page - 1)} className="rounded-full border border-navy-100 px-3 py-2 text-xs font-semibold text-navy-500 disabled:opacity-30">← Trước</button><span className="text-xs text-navy-400">Trang {pagination.page}/{pagination.totalPages}</span><button type="button" disabled={searching || pagination.page >= pagination.totalPages} onClick={() => loadQuestions(pagination.page + 1)} className="rounded-full border border-navy-100 px-3 py-2 text-xs font-semibold text-navy-500 disabled:opacity-30">Sau →</button></div>}

          {selected.size > 0 && <div className="rounded-xl bg-pastel-100 p-3"><p className="text-xs font-semibold text-navy-500">Câu đã chọn ({selected.size}) · dùng nút mũi tên để đổi thứ tự</p><div className="mt-2 space-y-2">{[...selected.values()].map((item, index, items) => <div key={item.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-navy-500"><strong>Câu {index + 1}</strong><span className="min-w-0 flex-1 truncate">{item.content}</span><button type="button" disabled={index === 0} onClick={() => moveSelected(item.id, -1)} aria-label={`Đưa câu ${index + 1} lên`} className="flex size-9 items-center justify-center rounded-lg border border-navy-100 disabled:opacity-25">↑</button><button type="button" disabled={index === items.length - 1} onClick={() => moveSelected(item.id, 1)} aria-label={`Đưa câu ${index + 1} xuống`} className="flex size-9 items-center justify-center rounded-lg border border-navy-100 disabled:opacity-25">↓</button><button type="button" onClick={() => toggleQuestion(item)} aria-label={`Bỏ câu ${index + 1}`} className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600">×</button></div>)}</div></div>}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-navy-400">Điểm/câu trắc nghiệm<input className={input} name="multipleChoicePoints" type="number" min="0.01" step="0.01" defaultValue="0.25" /></label>
          <label className="text-xs text-navy-400">Điểm/câu đúng-sai<input className={input} name="trueFalsePoints" type="number" min="0.01" step="0.01" defaultValue="1" /></label>
          <label className="text-xs text-navy-400">Điểm/câu trả lời ngắn<input className={input} name="shortAnswerPoints" type="number" min="0.01" step="0.01" defaultValue="0.5" /></label>
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <button disabled={pending || !classes.length || !selected.size} className="rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Đang tạo…" : `Tạo từ ${selected.size} câu đã chọn`}</button>
      </form>
    </details>
  );
}
