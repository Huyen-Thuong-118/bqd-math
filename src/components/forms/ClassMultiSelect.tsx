"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ClassMultiSelectOption = {
  id: string;
  name: string;
  code?: string;
  level?: string;
};

function levelLabel(level?: string) {
  if (level === "ADVANCED") return "Nâng cao";
  if (level === "BASIC") return "Cơ bản";
  return "";
}

function optionLabel(item: ClassMultiSelectOption) {
  return [item.code, item.name, levelLabel(item.level)].filter(Boolean).join(" · ");
}

export function ClassMultiSelect({
  classes,
  defaultSelected = [],
  label = "Giao cho lớp",
  name = "classIds",
  className,
}: {
  classes: ClassMultiSelectOption[];
  defaultSelected?: readonly string[];
  label?: string;
  name?: string;
  className?: string;
}) {
  const searchId = useId();
  const validIds = useMemo(() => new Set(classes.map((item) => item.id)), [classes]);
  const [selected, setSelected] = useState(() => new Set(defaultSelected.filter((id) => validIds.has(id))));
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const visibleClasses = useMemo(() => {
    if (!normalizedQuery) return classes;
    return classes.filter((item) => optionLabel(item).toLocaleLowerCase("vi").includes(normalizedQuery));
  }, [classes, normalizedQuery]);

  const selectedClasses = classes.filter((item) => selected.has(item.id));

  function toggle(classId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  function selectVisible() {
    setSelected((current) => new Set([...current, ...visibleClasses.map((item) => item.id)]));
  }

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-1 text-sm font-medium text-navy-500">{label}</legend>
      {[...selected].map((classId) => <input key={classId} type="hidden" name={name} value={classId} />)}

      <details className="group relative">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600 outline-none transition hover:border-navy-300 focus-visible:ring-2 focus-visible:ring-navy-300 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 truncate">
            {selectedClasses.length
              ? `Đã chọn ${selectedClasses.length} lớp: ${selectedClasses.map((item) => item.code || item.name).join(", ")}`
              : "Chọn lớp được giao"}
          </span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>

        <div className="relative z-30 mt-2 rounded-2xl border border-navy-100 bg-white p-3 shadow-xl">
          <label htmlFor={searchId} className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-300" aria-hidden />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo mã hoặc tên lớp..."
              className="w-full rounded-xl border border-navy-100 bg-pastel-50 py-2.5 pl-9 pr-9 text-sm text-navy-600 outline-none focus:border-navy-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Xóa nội dung tìm kiếm" className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-navy-300 hover:bg-white hover:text-navy-600">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </label>

          <div className="mt-2 flex items-center justify-between gap-3 px-1 text-xs">
            <span className="text-navy-300">{visibleClasses.length} lớp phù hợp</span>
            <div className="flex gap-3">
              {visibleClasses.length > 0 && <button type="button" onClick={selectVisible} className="font-semibold text-navy-500 hover:text-navy-700">Chọn tất cả</button>}
              {selected.size > 0 && <button type="button" onClick={() => setSelected(new Set())} className="font-semibold text-red-600 hover:text-red-700">Bỏ chọn</button>}
            </div>
          </div>

          <div className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1">
            {visibleClasses.map((item) => {
              const checked = selected.has(item.id);
              return (
                <label key={item.id} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition", checked ? "border-navy-300 bg-pastel-100 text-navy-700" : "border-transparent bg-pastel-50 text-navy-500 hover:border-navy-100")}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} className="sr-only" />
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", checked ? "border-navy-500 bg-navy-500 text-white" : "border-navy-200 bg-white")}>
                    {checked && <Check className="size-3.5" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{optionLabel(item)}</span>
                </label>
              );
            })}
            {visibleClasses.length === 0 && <p className="rounded-xl bg-pastel-50 px-3 py-5 text-center text-sm text-navy-300">Không tìm thấy lớp phù hợp.</p>}
          </div>
        </div>
      </details>

      {classes.length === 0 && <p className="mt-2 text-sm text-amber-700">Chưa có lớp đang hoạt động.</p>}
    </fieldset>
  );
}
