import type { ExamQuestionType } from "./types";

export type AnswerableQuestion = {
  type: ExamQuestionType;
  options: readonly string[];
};

export function normalizeExamAnswer(value: string | null | undefined, type: ExamQuestionType) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  if (type === "SHORT_ANSWER") return normalized.replace(/\s/g, "").replace(",", ".");
  if (type === "TRUE_FALSE") return normalized.replace(/Đ/g, "D").replace(/\s*,\s*/g, ",");
  return normalized;
}

export function isValidExamAnswer(question: AnswerableQuestion, value: string | null | undefined) {
  const answer = normalizeExamAnswer(value, question.type);
  if (!answer) return value === null || value === undefined || value.trim() === "";
  if (question.type === "SHORT_ANSWER") return answer.length <= 50;
  if (question.type === "MULTIPLE_CHOICE") {
    const index = answer.charCodeAt(0) - 65;
    return /^[A-Z]$/.test(answer) && index >= 0 && index < question.options.length;
  }
  const statements = answer.split(",");
  return question.options.length > 0 && statements.length === question.options.length && statements.every((statement) => statement === "D" || statement === "S");
}

export function answersEquivalent(selectedAnswer: string | null, correctAnswer: string, type: ExamQuestionType) {
  if (!selectedAnswer) return false;
  if (type !== "SHORT_ANSWER") return selectedAnswer === correctAnswer;
  const selectedNumber = Number(selectedAnswer);
  const correctNumber = Number(correctAnswer);
  if (Number.isFinite(selectedNumber) && Number.isFinite(correctNumber)) return selectedNumber === correctNumber;
  return selectedAnswer === correctAnswer;
}
