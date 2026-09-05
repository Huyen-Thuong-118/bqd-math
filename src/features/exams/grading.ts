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

export function normalizeAnswer(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

/** Hàm thuần: điểm cuối cùng quy về thang 10, làm tròn hai chữ số. */
export function gradeExam(
  questions: GradableQuestion[],
  latestAnswers: ReadonlyMap<number, string>,
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
    const selectedAnswer = normalizeAnswer(latestAnswers.get(question.number));
    const correctAnswer = normalizeAnswer(question.correctAnswer)!;
    const isCorrect = selectedAnswer === correctAnswer;

    if (!selectedAnswer) unansweredCount += 1;
    else if (isCorrect) correctCount += 1;
    else incorrectCount += 1;

    let pointsAwarded = isCorrect ? question.points : 0;
    if (question.type === "TRUE_FALSE" && selectedAnswer && !isCorrect) {
      const selected = selectedAnswer.split(",");
      const correct = correctAnswer.split(",");
      const correctStatements = correct.filter((value, index) => value === selected[index]).length;
      const standardScore = [0, 0.1, 0.25, 0.5, 1][correctStatements];
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
