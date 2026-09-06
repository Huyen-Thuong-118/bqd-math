import Link from "next/link";

import {
  reviewQuestionFilterParams,
  type ReviewQuestionFilters as ReviewFilters,
} from "../filters";

type Chapter = { id: string; name: string; order: number };
type ClassOption = { id: string; name: string };

const control =
  "w-full rounded-xl border border-navy-100 bg-white px-3 py-2 text-sm text-navy-500 outline-none focus:border-navy-400";

export function AdminReviewQuestionFilters({
  filters,
  chapters,
  classes,
  total,
}: {
  filters: ReviewFilters;
  chapters: Chapter[];
  classes: ClassOption[];
  total: number;
}) {
  return (
    <form
      action="/admin/cau-hoi-on-tap"
      className="grid gap-3 rounded-2xl border border-navy-100 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <label className="text-xs text-navy-400 sm:col-span-2">
        Tìm kiếm
        <input className={control} name="q" defaultValue={filters.q} maxLength={200} placeholder="Nội dung, chủ đề, khối hoặc chương…" />
      </label>
      <label className="text-xs text-navy-400">
        Chương
        <select className={control} name="chapterId" defaultValue={filters.chapterId}>
          <option value="">Mọi chương</option>
          {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.order}. {chapter.name}</option>)}
        </select>
      </label>
      <label className="text-xs text-navy-400">
        Lớp được giao
        <select className={control} name="classId" defaultValue={filters.classId}>
          <option value="">Mọi lớp</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="text-xs text-navy-400">
        Loại câu
        <select className={control} name="type" defaultValue={filters.type ?? ""}>
          <option value="">Mọi loại</option>
          <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
          <option value="TRUE_FALSE">Đúng / Sai</option>
          <option value="SHORT_ANSWER">Trả lời ngắn</option>
        </select>
      </label>
      <label className="text-xs text-navy-400">
        Độ khó
        <select className={control} name="difficulty" defaultValue={filters.difficulty ?? ""}>
          <option value="">Mọi độ khó</option>
          <option value="EASY">Dễ</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="HARD">Khó</option>
        </select>
      </label>
      <label className="text-xs text-navy-400">
        Khối
        <input className={control} name="grade" defaultValue={filters.grade} maxLength={50} placeholder="Ví dụ: 12" />
      </label>
      <label className="text-xs text-navy-400">
        Chủ đề
        <input className={control} name="topic" defaultValue={filters.topic} maxLength={120} placeholder="Ví dụ: Hàm số" />
      </label>
      <label className="text-xs text-navy-400 sm:col-span-2 xl:col-span-1">
        Lời giải
        <select className={control} name="solution" defaultValue={filters.solution ?? ""}>
          <option value="">Tất cả</option>
          <option value="HAS_SOLUTION">Có lời giải</option>
          <option value="NO_SOLUTION">Chưa có lời giải</option>
          <option value="VISIBLE">Đang hiện lời giải</option>
          <option value="HIDDEN">Đang ẩn lời giải</option>
        </select>
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-3">
        <button className="rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white">Lọc câu hỏi</button>
        <Link href="/admin/cau-hoi-on-tap" className="rounded-full border border-navy-100 px-5 py-2.5 text-sm font-semibold text-navy-500">Xóa bộ lọc</Link>
        <span className="ml-auto text-xs text-navy-300">{total} kết quả</span>
      </div>
    </form>
  );
}

export function StudentReviewQuestionFilters({
  chapterId,
  filters,
  options,
  total,
}: {
  chapterId: string;
  filters: ReviewFilters;
  options: { classes: ClassOption[]; topics: string[]; grades: string[] };
  total: number;
}) {
  return (
    <details className="rounded-2xl border border-navy-100 bg-white p-4" open>
      <summary className="cursor-pointer text-sm font-semibold text-navy-500">Tìm và lọc câu hỏi · {total} kết quả</summary>
      <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-navy-400 sm:col-span-2">
          Tìm kiếm
          <input className={control} name="q" defaultValue={filters.q} maxLength={200} placeholder="Nội dung, chủ đề…" />
        </label>
        <label className="text-xs text-navy-400">
          Loại câu
          <select className={control} name="type" defaultValue={filters.type ?? ""}>
            <option value="">Mọi loại</option>
            <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
            <option value="TRUE_FALSE">Đúng / Sai</option>
            <option value="SHORT_ANSWER">Trả lời ngắn</option>
          </select>
        </label>
        <label className="text-xs text-navy-400">
          Độ khó
          <select className={control} name="difficulty" defaultValue={filters.difficulty ?? ""}>
            <option value="">Mọi độ khó</option>
            <option value="EASY">Dễ</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HARD">Khó</option>
          </select>
        </label>
        <label className="text-xs text-navy-400">
          Lớp
          <select className={control} name="classId" defaultValue={filters.classId}>
            <option value="">Mọi lớp</option>
            {options.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-navy-400">
          Khối
          <select className={control} name="grade" defaultValue={filters.grade}>
            <option value="">Mọi khối</option>
            {options.grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
        </label>
        <label className="text-xs text-navy-400">
          Chủ đề
          <select className={control} name="topic" defaultValue={filters.topic}>
            <option value="">Mọi chủ đề</option>
            {options.topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white">Lọc</button>
          <Link href={`/on-tap/${chapterId}`} className="rounded-full border border-navy-100 px-4 py-2.5 text-sm font-semibold text-navy-500">Xóa lọc</Link>
        </div>
      </form>
    </details>
  );
}

export function ReviewQuestionPagination({
  pathname,
  filters,
  page,
  totalPages,
}: {
  pathname: string;
  filters: ReviewFilters;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const href = (nextPage: number) => {
    const params = reviewQuestionFilterParams(filters, { page: nextPage });
    return `${pathname}?${params.toString()}`;
  };
  return (
    <nav aria-label="Phân trang câu hỏi" className="flex items-center justify-center gap-3">
      {page > 1 ? <Link href={href(page - 1)} className="rounded-full border border-navy-100 bg-white px-4 py-2 text-sm font-semibold text-navy-500">← Trang trước</Link> : <span />}
      <span className="text-sm text-navy-400">Trang {page}/{totalPages}</span>
      {page < totalPages ? <Link href={href(page + 1)} className="rounded-full border border-navy-100 bg-white px-4 py-2 text-sm font-semibold text-navy-500">Trang sau →</Link> : <span />}
    </nav>
  );
}
