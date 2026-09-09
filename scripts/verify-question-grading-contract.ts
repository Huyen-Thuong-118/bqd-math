import { gradeExam } from "../src/features/exams/grading";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main() {
  const multipleChoice = gradeExam(
    [{ id: "mc", number: 1, type: "MULTIPLE_CHOICE", options: ["A", "B", "C", "D", "E"], correctAnswer: "E", points: 1 }],
    new Map([[1, "E"]]),
  );
  assert(multipleChoice.score === 10, "MC 5 options phải chấm được.");

  const invalidChoice = gradeExam(
    [{ id: "mc", number: 1, type: "MULTIPLE_CHOICE", options: ["A", "B"], correctAnswer: "B", points: 1 }],
    new Map([[1, "E"]]),
  );
  assert(invalidChoice.unansweredCount === 1, "Option ngoài contract không được nhận điểm.");

  const trueFalse = gradeExam(
    [{ id: "tf", number: 1, type: "TRUE_FALSE", options: ["a", "b", "c", "d", "e"], correctAnswer: "D,S,D,S,D", points: 1 }],
    new Map([[1, "D,S,D,S,S"]]),
  );
  assert(trueFalse.score === 8, "TF 5 mệnh đề phải tính partial score theo số mệnh đề.");

  const decimal = gradeExam(
    [{ id: "short", number: 1, type: "SHORT_ANSWER", options: [], correctAnswer: "1.5", points: 1 }],
    new Map([[1, "1,50"]]),
  );
  assert(decimal.score === 10, "Short answer decimal tương đương phải chấm đúng.");
  console.log("✓ Question validation and grading contract passed.");
}

main();
