import { answersEquivalent, isValidExamAnswer, normalizeExamAnswer } from "./question-contract";

export type GradableQuestion = {
  id: string;
  number: number;
  type?: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  correctAnswer: string;
  points: number;
  options?: string[];
};

export type GradedAnswer = {
  questionId: string;
  questionNumber: number;
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  pointsAwarded: number;
  pointsPossible: number;
};

export type GradeResult = {
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  answers: GradedAnswer[];
};

export type ScoringPolicy = { trueFalseFractions?: number[] };

export const normalizeAnswer = normalizeExamAnswer;

export function gradeExam(
  questions: GradableQuestion[],
  latestAnswers: ReadonlyMap<number, string>,
  scoringPolicy: ScoringPolicy = {},
): GradeResult {
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
  if (questions.length === 0 || totalPoints <= 0) throw new Error("Đề thi chưa có câu hỏi hợp lệ để chấm.");

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let earnedPoints = 0;

  const answers = questions.map<GradedAnswer>((question) => {
    const type = question.type ?? "MULTIPLE_CHOICE";
    const options = question.options ?? (type === "TRUE_FALSE" ? ["a", "b", "c", "d"] : ["A", "B", "C", "D"]);
    const rawSelectedAnswer = latestAnswers.get(question.number);
    const selectedAnswer = isValidExamAnswer({ type, options }, rawSelectedAnswer)
      ? normalizeExamAnswer(rawSelectedAnswer, type)
      : null;
    const correctAnswer = normalizeExamAnswer(question.correctAnswer, type)!;
    const isCorrect = answersEquivalent(selectedAnswer, correctAnswer, type);

    if (!selectedAnswer) unansweredCount += 1;
    else if (isCorrect) correctCount += 1;
    else incorrectCount += 1;

    let pointsAwarded = isCorrect ? question.points : 0;
    if (type === "TRUE_FALSE" && selectedAnswer && !isCorrect) {
      const selected = selectedAnswer.split(",");
      const correct = correctAnswer.split(",");
      const correctStatements = correct.filter((value, index) => value === selected[index]).length;
      const fractions = correct.length === 4 && scoringPolicy.trueFalseFractions?.length === 5
        ? scoringPolicy.trueFalseFractions
        : null;
      pointsAwarded = (fractions?.[correctStatements] ?? correctStatements / correct.length) * question.points;
    }
    earnedPoints += pointsAwarded;
    return { questionId: question.id, questionNumber: question.number, selectedAnswer, correctAnswer, isCorrect, pointsAwarded, pointsPossible: question.points };
  });

  return { score: Math.round((earnedPoints / totalPoints) * 1000) / 100, correctCount, incorrectCount, unansweredCount, answers };
}
