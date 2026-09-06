import { FileQuestion, Files, Search, Shapes } from "lucide-react";
import Link from "next/link";

import type { SearchData, SearchFilters, SearchType } from "../types";

const typeLabels: Record<SearchType, string> = { all: "Tất cả", exam: "Đề thi", document: "Tài liệu", question: "Câu hỏi" };

function href(basePath: string, filters: SearchFilters, patch: Partial<SearchFilters>) {
  const next = { ...filters, ...patch };
  const query = new URLSearchParams();
  if (next.q) query.set("q", next.q);
  if (next.type !== "all") query.set("type", next.type);
  if (next.classId) query.set("classId", next.classId);
  if (next.page > 1) query.set("page", String(next.page));
  return basePath + "?" + query.toString();
}

export function SearchResultsPage({ data, filters }: { data: SearchData; filters: SearchFilters }) {
  const basePath = data.role === "ADMIN" ? "/admin/tim-kiem" : "/tim-kiem";
  const groups = [
    { type: "exam" as const, title: "Đề thi", icon: FileQuestion, result: data.exams },
    { type: "document" as const, title: "Tài liệu", icon: Files, result: data.documents },
    { type: "question" as const, title: "Câu hỏi ôn tập", icon: Shapes, result: data.questions },
  ].filter((group) => filters.type === "all" || filters.type === group.type);
  return (
    <section className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-navy-600">Tìm kiếm</h1><p className="mt-1 text-sm text-navy-300">Tìm đề thi, tài liệu và câu hỏi trong phạm vi bạn được phép xem.</p></div>
      <form method="get" action={basePath} className="grid gap-3 rounded-3xl border border-navy-100 bg-white p-4 sm:grid-cols-[1fr_15rem_auto] sm:items-end">
        <label className="text-xs text-navy-400">Từ khóa<div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-navy-300" /><input autoFocus name="q" defaultValue={filters.q} maxLength={100} placeholder="Tên đề, tài liệu, nội dung câu hỏi…" className="mt-1 w-full rounded-xl border border-navy-100 py-2.5 pr-3 pl-9 text-sm text-navy-600 outline-none focus:border-navy-400" /></div></label>
        <label className="text-xs text-navy-400">Lớp<select name="classId" defaultValue={filters.classId} className="mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600"><option value="">Tất cả lớp</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        {filters.type !== "all" && <input type="hidden" name="type" value={filters.type} />}
        <button className="min-h-11 rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white">Tìm kiếm</button>
      </form>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Loại kết quả">
        {(Object.keys(typeLabels) as SearchType[]).map((type) => <Link key={type} href={href(basePath, filters, { type, page: 1 })} className={"whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold " + (filters.type === type ? "bg-navy-600 text-white" : "bg-white text-navy-500")}>{typeLabels[type]}</Link>)}
      </nav>

      {!data.q ? (
        <div className="rounded-3xl border border-dashed border-navy-100 bg-white p-12 text-center"><Search className="mx-auto size-10 text-navy-200" /><p className="mt-3 text-sm text-navy-400">Nhập từ khóa để bắt đầu. Hệ thống không tải toàn bộ dữ liệu khi từ khóa trống.</p></div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ type, title, icon: Icon, result }) => <section key={type} className="rounded-3xl border border-navy-100 bg-white p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold text-navy-600"><Icon className="size-5" />{title}</h2><span className="text-xs text-navy-300">{result.total} kết quả</span></div><div className="mt-4 divide-y divide-navy-50">{result.items.map((item) => <Link key={item.id} href={item.href} className="block py-4 first:pt-0 last:pb-0"><p className="line-clamp-2 text-sm font-semibold text-navy-600">{item.title}</p><p className="mt-1 text-xs text-navy-400">{item.description}</p><p className="mt-1 text-xs text-navy-300">📁 {item.breadcrumb || "—"}{item.classes.length ? " · " + item.classes.join(", ") : ""}</p></Link>)}{!result.items.length && <p className="py-8 text-center text-sm text-navy-300">Không có {title.toLocaleLowerCase("vi")} phù hợp.</p>}</div></section>)}
        </div>
      )}

      {data.q && data.totalPages > 1 && <div className="flex items-center justify-center gap-3"><Link aria-disabled={filters.page <= 1} href={href(basePath, filters, { page: Math.max(1, filters.page - 1) })} className="rounded-full border border-navy-100 bg-white px-4 py-2 text-sm font-semibold text-navy-500">← Trước</Link><span className="text-sm text-navy-300">Trang {filters.page}/{data.totalPages}</span><Link aria-disabled={filters.page >= data.totalPages} href={href(basePath, filters, { page: Math.min(data.totalPages, filters.page + 1) })} className="rounded-full border border-navy-100 bg-white px-4 py-2 text-sm font-semibold text-navy-500">Sau →</Link></div>}
    </section>
  );
}
