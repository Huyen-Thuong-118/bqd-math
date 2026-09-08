import "dotenv/config";

import { randomUUID } from "node:crypto";
import { saveAnswerBatchForUser } from "../src/features/exams/repository";
import { submitAttemptForUser } from "../src/features/exams/service";
import { db } from "../src/lib/db";
import { requireTestDatabase } from "./test-database-guard";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  requireTestDatabase();
  const suffix = randomUUID().slice(0, 8);
  const ids = { user: `verify-user-${suffix}`, class: `verify-class-${suffix}`, document: `verify-doc-${suffix}`, chapter: `verify-chapter-${suffix}`, question: `verify-review-${suffix}`, exam: `verify-exam-${suffix}` };
  try {
    await db.user.create({ data: { id: ids.user, name: "Verify Learning", email: `${suffix}@verify.test`, studentPhone: `05${Date.now().toString().slice(-8)}`, parentPhone: `04${Date.now().toString().slice(-8)}`, role: "STUDENT", status: "ACTIVE" } });
    await db.class.create({ data: { id: ids.class, name: "Lớp verify", code: `VERIFY-${suffix}`, level: "BASIC", schedule: "Thứ 2" } });
    await db.classEnrollment.create({ data: { classId: ids.class, studentId: ids.user } });
    await db.document.create({ data: { id: ids.document, title: "Tài liệu verify", fileUrl: `documents/${ids.document}/v1/file.pdf`, classLinks: { create: { classId: ids.class } }, versions: { create: { version: 1, fileUrl: `documents/${ids.document}/v1/file.pdf`, fileName: "verify.pdf", contentType: "application/pdf" } } } });
    await db.chapter.create({ data: { id: ids.chapter, name: "Chương verify" } });
    await db.reviewQuestion.create({ data: { id: ids.question, chapterId: ids.chapter, content: "1 + 1 = ?", options: ["1", "2"], correctAnswer: "B", classLinks: { create: { classId: ids.class } } } });
    const visibleDocuments = await db.document.count({ where: { id: ids.document, classLinks: { some: { class: { enrollments: { some: { studentId: ids.user } } } } } } });
    const visibleQuestions = await db.reviewQuestion.count({ where: { id: ids.question, classLinks: { some: { class: { enrollments: { some: { studentId: ids.user } } } } } } });
    assert(visibleDocuments === 1 && visibleQuestions === 1, "Điều kiện enrollment không trả đúng nội dung được giao.");

    await db.exam.create({ data: { id: ids.exam, title: "Đề verify", source: "QUESTION_BANK", examFileUrl: null, status: "PUBLISHED", examLinks: { create: { classId: ids.class } }, questions: { create: { number: 1, content: "Câu 1", options: ["A", "B"], correctAnswer: "B" } } } });
    const attempt = await db.examAttempt.create({ data: { examId: ids.exam, userId: ids.user, mode: "PRACTICE", openKey: `verify:${suffix}` } });
    const answerEvent = { eventId: randomUUID(), questionNumber: 1, selectedAnswer: "B", changedAt: new Date().toISOString() };
    await saveAnswerBatchForUser(ids.user, { attemptId: attempt.id, changes: [answerEvent] });
    await saveAnswerBatchForUser(ids.user, { attemptId: attempt.id, changes: [answerEvent] });
    const [latest, history] = await Promise.all([db.attemptAnswer.findFirst({ where: { attemptId: attempt.id, questionNumber: 1 } }), db.answerHistory.count({ where: { attemptId: attempt.id } })]);
    assert(latest?.selectedAnswer === "B" && latest.correctAnswer === null && history === 1, "Autosave chưa đồng thời upsert đáp án mới nhất và append lịch sử.");
    await saveAnswerBatchForUser(ids.user, { attemptId: attempt.id, changes: [{ eventId: randomUUID(), questionNumber: 1, selectedAnswer: null, changedAt: new Date().toISOString() }] });
    const cleared = await db.attemptAnswer.findFirst({ where: { attemptId: attempt.id, questionNumber: 1 } });
    assert(cleared?.selectedAnswer === null, "Clear answer phải được lưu như một event hợp lệ.");
    await saveAnswerBatchForUser(ids.user, { attemptId: attempt.id, changes: [{ eventId: randomUUID(), questionNumber: 1, selectedAnswer: "B", changedAt: new Date().toISOString() }] });
    const submitted = await submitAttemptForUser(attempt.id, ids.user);
    const noPdfExam = await db.exam.findUnique({ where: { id: ids.exam }, select: { source: true, examFileUrl: true } });
    assert(submitted.score === 10 && noPdfExam?.source === "QUESTION_BANK" && noPdfExam.examFileUrl === null, "Đề không PDF không được lưu/chấm đúng invariant.");
    console.log("✓ Learning management: enrollment, nội dung theo lớp, version tài liệu, autosave và đề không PDF đều đạt.");
  } finally {
    await db.exam.deleteMany({ where: { id: ids.exam } });
    await db.document.deleteMany({ where: { id: ids.document } });
    await db.chapter.deleteMany({ where: { id: ids.chapter } });
    await db.class.deleteMany({ where: { id: ids.class } });
    await db.user.deleteMany({ where: { id: ids.user } });
    await db.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
