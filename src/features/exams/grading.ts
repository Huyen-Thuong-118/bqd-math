export type GradableQuestion = {
  id: string;
  number: number;
  type?: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  correctAnswer: string;
  points: number;
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

export function normalizeAnswer(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function normalizeForType(value: string | null | undefined, type: GradableQuestion["type"]) {
  if (type === "SHORT_ANSWER") {
    const shortAnswer = value?.trim();
    if (!shortAnswer) return null;
    return shortAnswer.replace(/\s/g, "").replace(",", ".");
  }
  const normalized = normalizeAnswer(value);
  if (!normalized) return null;
  if (type === "TRUE_FALSE") return normalized.replace(/Đ/g, "D").replace(/\s*,\s*/g, ",");
  return normalized;
}

/** Hàm thuần: điểm cuối cùng quy về thang 10, làm tròn hai chữ số. */
export function gradeExam(
  questions: GradableQuestion[],
  latestAnswers: ReadonlyMap<number, string>,
  scoringPolicy: ScoringPolicy = {},
): GradeResult {
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
  if (questions.length === 0 || totalPoints <= 0) {
    throw new Error("Đề thi chưa có câu hỏi hợp lệ để chấm.");
  }

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let earnedPoints = 0;

  const answers = questions.map<GradedAnswer>((question) => {
    const selectedAnswer = normalizeForType(latestAnswers.get(question.number), question.type);
    const correctAnswer = normalizeForType(question.correctAnswer, question.type)!;
    const isCorrect = selectedAnswer === correctAnswer;

    if (!selectedAnswer) unansweredCount += 1;
    else if (isCorrect) correctCount += 1;
    else incorrectCount += 1;

    let pointsAwarded = isCorrect ? question.points : 0;
    if (question.type === "TRUE_FALSE" && selectedAnswer && !isCorrect) {
      const selected = selectedAnswer.split(",");
      const correct = correctAnswer.split(",");
      const correctStatements = correct.filter((value, index) => value === selected[index]).length;
      const fractions = scoringPolicy.trueFalseFractions?.length === 5
        ? scoringPolicy.trueFalseFractions
        : [0, 0.1, 0.25, 0.5, 1];
      const standardScore = fractions[correctStatements] ?? 0;
      pointsAwarded = standardScore * question.points;
    }
    earnedPoints += pointsAwarded;
    return {
      questionId: question.id,
      questionNumber: question.number,
      selectedAnswer,
      correctAnswer,
      isCorrect,
      pointsAwarded,
      pointsPossible: question.points,
    };
  });

  return {
    score: Math.round((earnedPoints / totalPoints) * 1000) / 100,
    correctCount,
    incorrectCount,
    unansweredCount,
    answers,
  };
}
