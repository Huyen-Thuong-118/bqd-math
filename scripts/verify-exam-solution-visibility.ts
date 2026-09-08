import { getSolutionVisibility } from "../src/features/exams/solution-visibility";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main() {
  const hidden = getSolutionVisibility({
    isAdmin: false,
    submitted: true,
    showAnswer: false,
    hideWrongAnswers: false,
    isCorrect: true,
    allAnswersCorrect: true,
  });
  assert(
    !hidden.correctAnswer && !hidden.explanation && !hidden.solutionFile && !hidden.solutionVideo,
    "showAnswer=false không được phát bất kỳ lời giải nào.",
  );

  const wrong = getSolutionVisibility({
    isAdmin: false,
    submitted: true,
    showAnswer: true,
    hideWrongAnswers: true,
    isCorrect: false,
    allAnswersCorrect: false,
  });
  assert(
    !wrong.correctAnswer && !wrong.explanation && !wrong.solutionFile && !wrong.solutionVideo,
    "Câu sai không được lộ qua DTO, PDF hoặc video.",
  );

  const correct = getSolutionVisibility({
    isAdmin: false,
    submitted: true,
    showAnswer: true,
    hideWrongAnswers: true,
    isCorrect: true,
    allAnswersCorrect: false,
  });
  assert(
    correct.correctAnswer && correct.explanation && !correct.solutionFile && !correct.solutionVideo,
    "Câu đúng có thể xem lời giải riêng nhưng không được nhận PDF toàn bộ.",
  );

  const allCorrect = getSolutionVisibility({
    isAdmin: false,
    submitted: true,
    showAnswer: true,
    hideWrongAnswers: true,
    isCorrect: true,
    allAnswersCorrect: true,
  });
  assert(allCorrect.solutionFile && allCorrect.solutionVideo, "Học sinh làm đúng toàn bộ phải xem được lời giải.");

  const admin = getSolutionVisibility({
    isAdmin: true,
    submitted: false,
    showAnswer: false,
    hideWrongAnswers: true,
  });
  assert(admin.correctAnswer && admin.explanation && admin.solutionFile && admin.solutionVideo, "Admin phải luôn xem được lời giải.");
  console.log("✓ Exam solution visibility matrix đạt.");
}

main();
