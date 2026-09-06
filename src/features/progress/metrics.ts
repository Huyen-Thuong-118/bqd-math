export type SubmittedExamScore = {
  examId: string;
  score: number | null;
  submittedAt: Date | null;
};

export function calculateExamScoreMetrics(attempts: SubmittedExamScore[]) {
  const scores = attempts
    .map((attempt) => attempt.score)
    .filter((score): score is number => score !== null);
  return {
    attempts: attempts.length,
    bestScore: scores.length ? Math.max(...scores) : null,
    latestScore: attempts.find((attempt) => attempt.score !== null)?.score ?? null,
    averageScore: scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null,
    latestAt: attempts[0]?.submittedAt?.toISOString() ?? null,
  };
}

export function calculateOverallExamProgress(
  assignedExamIds: string[],
  attempts: SubmittedExamScore[],
) {
  const completedExamIds = new Set(attempts.map((attempt) => attempt.examId));
  const scoreMetrics = calculateExamScoreMetrics(attempts);
  return {
    assignedExams: assignedExamIds.length,
    completedExams: completedExamIds.size,
    pendingExams: assignedExamIds.filter((id) => !completedExamIds.has(id)).length,
    submittedAttempts: attempts.length,
    bestScore: scoreMetrics.bestScore,
    latestScore: scoreMetrics.latestScore,
    averageScore: scoreMetrics.averageScore,
  };
}
