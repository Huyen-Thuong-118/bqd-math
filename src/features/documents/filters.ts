export const DOCUMENT_PAGE_SIZE = 20;

export type DocumentTypeFilter = "PDF" | "IMAGE" | "VIDEO" | "OTHER";
export type DocumentSort = "NEWEST" | "OLDEST" | "TITLE" | "UPDATED";

export type StudentDocumentFilters = {
  q: string;
  folderId: string;
  includeChildren: boolean;
  classId: string;
  type?: DocumentTypeFilter;
  publishedAnswer: boolean;
  downloadable: boolean;
  sort: DocumentSort;
  page: number;
};

type FilterInput = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseStudentDocumentFilters(input: FilterInput): StudentDocumentFilters {
  const rawType = first(input.type);
  const rawSort = first(input.sort);
  const rawPage = Number(first(input.page));
  return {
    q: first(input.q).slice(0, 200),
    folderId: first(input.folderId).slice(0, 100),
    includeChildren: first(input.includeChildren) !== "0",
    classId: first(input.classId).slice(0, 100),
    type: (["PDF", "IMAGE", "VIDEO", "OTHER"] as const).includes(rawType as DocumentTypeFilter)
      ? rawType as DocumentTypeFilter
      : undefined,
    publishedAnswer: first(input.publishedAnswer) === "1",
    downloadable: first(input.downloadable) === "1",
    sort: (["NEWEST", "OLDEST", "TITLE", "UPDATED"] as const).includes(rawSort as DocumentSort)
      ? rawSort as DocumentSort
      : "NEWEST",
    page: Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
  };
}

export function studentDocumentFilterParams(
  filters: StudentDocumentFilters,
  page = filters.page,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.folderId) params.set("folderId", filters.folderId);
  if (!filters.includeChildren) params.set("includeChildren", "0");
  if (filters.classId) params.set("classId", filters.classId);
  if (filters.type) params.set("type", filters.type);
  if (filters.publishedAnswer) params.set("publishedAnswer", "1");
  if (filters.downloadable) params.set("downloadable", "1");
  if (filters.sort !== "NEWEST") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  return params;
}
