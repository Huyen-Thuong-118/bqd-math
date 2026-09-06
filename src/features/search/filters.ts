import type { SearchFilters, SearchType } from "./types";

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseSearchFilters(raw: Record<string, string | string[] | undefined>): SearchFilters {
  const typeValue = first(raw.type);
  return {
    q: first(raw.q).slice(0, 100),
    type: (["exam", "document", "question"].includes(typeValue) ? typeValue : "all") as SearchType,
    classId: first(raw.classId).slice(0, 100),
    page: Math.max(1, Math.min(10_000, Number.parseInt(first(raw.page), 10) || 1)),
  };
}
