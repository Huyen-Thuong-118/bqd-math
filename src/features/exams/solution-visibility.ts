export type SolutionVisibilityInput = {
  isAdmin: boolean;
  submitted: boolean;
  showAnswer: boolean;
  hideWrongAnswers: boolean;
  isCorrect?: boolean | null;
  allAnswersCorrect?: boolean;
};

export type SolutionVisibility = {
  correctAnswer: boolean;
  explanation: boolean;
  solutionFile: boolean;
  solutionVideo: boolean;
};

/**
 * Single server-side policy for every representation of an exam solution.
 * A full solution file/video is only safe under hideWrongAnswers when no
 * answer must be hidden for that student.
 */
export function getSolutionVisibility(
  input: SolutionVisibilityInput,
): SolutionVisibility {
  if (input.isAdmin) {
    return {
      correctAnswer: true,
      explanation: true,
      solutionFile: true,
      solutionVideo: true,
    };
  }

  const canViewAnySolution = input.submitted && input.showAnswer;
  const canViewQuestion =
    canViewAnySolution &&
    (!input.hideWrongAnswers || input.isCorrect === true);
  const canViewFullSolution =
    canViewAnySolution &&
    (!input.hideWrongAnswers || input.allAnswersCorrect === true);

  return {
    correctAnswer: canViewQuestion,
    explanation: canViewQuestion,
    solutionFile: canViewFullSolution,
    solutionVideo: canViewFullSolution,
  };
}
