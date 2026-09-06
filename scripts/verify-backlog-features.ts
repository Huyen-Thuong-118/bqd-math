import "dotenv/config";

import { db } from "../src/lib/db";
import { parseStudentDocumentFilters } from "../src/features/documents/filters";
import { gradeExam } from "../src/features/exams/grading";
import {
  calculateExamScoreMetrics,
  calculateOverallExamProgress,
} from "../src/features/progress/metrics";
import { parseReviewQuestionFilters } from "../src/features/review-questions/filters";
import { parseSearchFilters } from "../src/features/search/filters";
import {
  generateStudentCode,
  isValidClassCode,
  normalizeClassCode,
} from "../src/lib/management-codes";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDensePositions(
  rows: { group: string; position: number }[],
  label: string,
) {
  const groups = new Map<string, number[]>();
  for (const row of rows) groups.set(row.group, [...(groups.get(row.group) ?? []), row.position]);
  for (const positions of groups.values()) {
    positions.sort((a, b) => a - b);
    assert(positions.every((position, index) => position === index), `${label} chưa có position liên tục.`);
  }
}

async function main() {
  const studentCode = generateStudentCode();
  assert(/^HS-[A-F0-9]{8}$/.test(studentCode), "Mã học sinh sinh ra sai định dạng.");
  assert(normalizeClassCode(" 12a1 - 2026 ") === "12A1-2026", "Normalize mã lớp chưa đúng.");
  assert(isValidClassCode("12A1-2026") && !isValidClassCode("A"), "Validate mã lớp chưa đúng.");

  const search = parseSearchFilters({ q: "%_Toán".repeat(40), type: "bad", page: "-2" });
  assert(search.q.length === 100 && search.type === "all" && search.page === 1, "Parser tìm kiếm không whitelist/giới hạn input.");
  const documents = parseStudentDocumentFilters({ type: "bad", sort: "TITLE", page: "2" });
  assert(documents.type === undefined && documents.sort === "TITLE" && documents.page === 2, "Parser filter tài liệu chưa đúng.");
  const questions = parseReviewQuestionFilters({ type: "TRUE_FALSE", difficulty: "HARD", solution: "bad" });
  assert(questions.type === "TRUE_FALSE" && questions.difficulty === "HARD" && questions.solution === undefined, "Parser filter câu hỏi chưa đúng.");

  const now = new Date("2026-09-07T12:00:00.000Z");
  const attempts = [
    { examId: "exam-a", score: 8, submittedAt: now },
    { examId: "exam-a", score: 6, submittedAt: new Date("2026-09-06T12:00:00.000Z") },
    { examId: "exam-b", score: 9, submittedAt: new Date("2026-09-05T12:00:00.000Z") },
  ];
  const oneExam = calculateExamScoreMetrics(attempts.slice(0, 2));
  assert(oneExam.bestScore === 8 && oneExam.latestScore === 8 && oneExam.averageScore === 7, "Metric best/latest/average theo đề sai.");
  const overall = calculateOverallExamProgress(["exam-a", "exam-b", "exam-c"], attempts);
  assert(overall.completedExams === 2 && overall.pendingExams === 1 && overall.submittedAttempts === 3, "Metric hoàn thành/chưa làm sai.");

  const graded = gradeExam(
    [
      { id: "q1", number: 1, type: "MULTIPLE_CHOICE", correctAnswer: "B", points: 1 },
      { id: "q2", number: 2, type: "TRUE_FALSE", correctAnswer: "D,S,D,S", points: 1 },
      { id: "q3", number: 3, type: "SHORT_ANSWER", correctAnswer: "2,5", points: 1 },
    ],
    new Map([[1, "B"], [2, "D,S,D,S"], [3, "2.5"]]),
  );
  assert(graded.score === 10 && graded.correctCount === 3, "Đề không PDF ba loại câu chưa chấm đúng.");

  const [studentsWithoutCode, pdfWithoutFile, noPdfWithoutQuestions, folderRows, documentRows, examRows] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", studentCode: null } }),
    db.exam.count({ where: { source: "PDF", examFileUrl: null } }),
    db.exam.count({ where: { source: { in: ["QUESTION_BANK", "MANUAL"] }, questions: { none: {} } } }),
    db.folder.findMany({ select: { kind: true, parentId: true, position: true } }),
    db.document.findMany({ select: { folderId: true, position: true } }),
    db.exam.findMany({ select: { folderId: true, position: true } }),
  ]);
  assert(studentsWithoutCode === 0, "Còn học sinh cũ chưa được backfill mã.");
  assert(pdfWithoutFile === 0 && noPdfWithoutQuestions === 0, "Dữ liệu đề vi phạm invariant nguồn đề.");
  assertDensePositions(folderRows.map((row) => ({ group: `${row.kind}:${row.parentId ?? "root"}`, position: row.position })), "Folder");
  assertDensePositions(documentRows.map((row) => ({ group: row.folderId ?? "root", position: row.position })), "Document");
  assertDensePositions(examRows.map((row) => ({ group: row.folderId ?? "root", position: row.position })), "Exam");

  console.log("✓ Backlog: filter, mã quản lý, metric tiến độ, 3 loại câu và invariant dữ liệu đều đạt.");
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
});
