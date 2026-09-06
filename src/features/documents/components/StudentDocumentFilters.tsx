import Link from "next/link";

import {
  studentDocumentFilterParams,
  type StudentDocumentFilters as DocumentFilters,
} from "../filters";

const control = "w-full rounded-xl border border-navy-100 bg-white px-3 py-2 text-sm text-navy-500 outline-none focus:border-navy-400";

export function StudentDocumentFilters({
  filters,
  options,
  total,
}: {
  filters: DocumentFilters;
  options: {
    classes: { id: string; name: string }[];
    folders: { id: string; label: string }[];
  };
  total: number;
}) {
  return (
    <details className="rounded-2xl border border-navy-100 bg-white p-4" open>
      <summary className="cursor-pointer text-sm font-semibold text-navy-500">Tìm và lọc tài liệu · {total} kết quả</summary>
      <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-navy-400 sm:col-span-2">
          Tìm kiếm
          <input className={control} name="q" defaultValue={filters.q} maxLength={200} placeholder="Tên tài liệu hoặc tên file…" />
        </label>
        <label className="text-xs text-navy-400">
          Thư mục
          <select className={control} name="folderId" defaultValue={filters.folderId}>
            <option value="">Mọi thư mục</option>
            {options.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}
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
          Loại file
          <select className={control} name="type" defaultValue={filters.type ?? ""}>
            <option value="">Mọi loại</option>
            <option value="PDF">PDF</option>
            <option value="IMAGE">Hình ảnh</option>
            <option value="VIDEO">Video</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        <label className="text-xs text-navy-400">
          Sắp xếp
          <select className={control} name="sort" defaultValue={filters.sort}>
            <option value="NEWEST">Mới nhất</option>
            <option value="UPDATED">Vừa cập nhật</option>
            <option value="OLDEST">Cũ nhất</option>
            <option value="TITLE">Tên A–Z</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-4 text-xs text-navy-500 sm:col-span-2">
          <label><input type="checkbox" name="includeChildren" value="0" defaultChecked={!filters.includeChildren} className="mr-1" /> Chỉ đúng thư mục đã chọn</label>
          <label><input type="checkbox" name="publishedAnswer" value="1" defaultChecked={filters.publishedAnswer} className="mr-1" /> Có đáp án công bố</label>
          <label><input type="checkbox" name="downloadable" value="1" defaultChecked={filters.downloadable} className="mr-1" /> Cho tải xuống</label>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button className="rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white">Lọc tài liệu</button>
          <Link href="/tai-lieu" className="rounded-full border border-navy-100 px-5 py-2.5 text-sm font-semibold text-navy-500">Xóa bộ lọc</Link>
        </div>
      </form>
    </details>
  );
}

export function StudentDocumentPagination({
  filters,
  page,
  totalPages,
}: {
  filters: DocumentFilters;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const href = (nextPage: number) => `/tai-lieu?${studentDocumentFilterParams(filters, nextPage).toString()}`;
  return (
    <nav aria-label="Phân trang tài liệu" className="flex items-center justify-center gap-3">
      {page > 1 ? <Link href={href(page - 1)} className="rounded-full border border-navy-100 bg-white px-4 py-2 text-sm font-semibold text-navy-500">← Trang trước</Link> : <span />}
      <span className="text-sm text-navy-400">Trang {page}/{totalPages}</span>
      {page < totalPages ? <Link href={href(page + 1)} className="rounded-full border border-navy-100 bg-white px-4 py-2 text-sm font-semibold text-navy-500">Trang sau →</Link> : <span />}
    </nav>
  );
}
