import type {
  QuestionDifficulty,
  ReviewQuestionType,
} from "@prisma/client";

export const REVIEW_QUESTION_PAGE_SIZE = 20;
export const QUESTION_BANK_PAGE_SIZE = 30;

export type SolutionFilter = "HAS_SOLUTION" | "NO_SOLUTION" | "VISIBLE" | "HIDDEN";

export type ReviewQuestionFilters = {
  q: string;
  chapterId: string;
  grade: string;
  topic: string;
  type?: ReviewQuestionType;
  difficulty?: QuestionDifficulty;
  classId: string;
  solution?: SolutionFilter;
  page: number;
};

type FilterInput = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function limited(value: string, maxLength: number) {
  return value.slice(0, maxLength);
}

export function parseReviewQuestionFilters(
  input: FilterInput,
  options: { allowSolution?: boolean } = {},
): ReviewQuestionFilters {
  const rawType = first(input.type);
  const rawDifficulty = first(input.difficulty);
  const rawSolution = first(input.solution);
  const rawPage = Number(first(input.page));

  return {
    q: limited(first(input.q), 200),
    chapterId: limited(first(input.chapterId), 100),
    grade: limited(first(input.grade), 50),
    topic: limited(first(input.topic), 120),
    type: (["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] as const).includes(
      rawType as ReviewQuestionType,
    )
      ? (rawType as ReviewQuestionType)
      : undefined,
    difficulty: (["EASY", "MEDIUM", "HARD"] as const).includes(
      rawDifficulty as QuestionDifficulty,
    )
      ? (rawDifficulty as QuestionDifficulty)
      : undefined,
    classId: limited(first(input.classId), 100),
    solution:
      options.allowSolution &&
      (["HAS_SOLUTION", "NO_SOLUTION", "VISIBLE", "HIDDEN"] as const).includes(
        rawSolution as SolutionFilter,
      )
        ? (rawSolution as SolutionFilter)
        : undefined,
    page: Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
  };
}

export function reviewQuestionFilterParams(
  filters: ReviewQuestionFilters,
  overrides: Partial<Record<keyof ReviewQuestionFilters, string | number | undefined>> = {},
) {
  const values = { ...filters, ...overrides };
  const params = new URLSearchParams();

  for (const key of [
    "q",
    "chapterId",
    "grade",
    "topic",
    "type",
    "difficulty",
    "classId",
    "solution",
  ] as const) {
    const value = values[key];
    if (value) params.set(key, String(value));
  }

  if (Number(values.page) > 1) params.set("page", String(values.page));
  return params;
}
