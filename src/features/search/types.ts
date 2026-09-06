export type SearchType = "all" | "exam" | "document" | "question";

export type SearchFilters = {
  q: string;
  type: SearchType;
  classId: string;
  page: number;
};

export type SearchItem = {
  id: string;
  title: string;
  description: string;
  breadcrumb: string;
  classes: string[];
  href: string;
};

export type SearchGroup = { items: SearchItem[]; total: number };

export type SearchData = {
  role: "ADMIN" | "STUDENT";
  q: string;
  classes: { id: string; code: string; name: string }[];
  exams: SearchGroup;
  documents: SearchGroup;
  questions: SearchGroup;
  totalPages: number;
};
