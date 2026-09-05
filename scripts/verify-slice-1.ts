import "dotenv/config";

import { randomUUID } from "node:crypto";

import { gradeExam } from "../src/features/exams/grading";
import {
  startAttemptForUser,
  submitAttemptForUser,
} from "../src/features/exams/service";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const demoEmail = process.env.SEED_STUDENT_EMAIL ?? "student@bqdmath.local";
const demoPassword = process.env.SEED_STUDENT_PASSWORD ?? "BqdMathStudent123!";
const demoExamId = "slice1-demo-exam";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function signInCredentials(identifier: string, password: string) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  assert(csrfResponse.ok, "Không lấy được CSRF token. Dev server đã chạy chưa?");
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  const csrfCookie = csrfResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-auth-return-redirect": "1",
      cookie: csrfCookie,
    },
    body: new URLSearchParams({
      identifier,
      password,
      csrfToken,
      callbackUrl: `${baseUrl}/thi-thu`,
    }),
  });
  const sessionCookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .find((value) => value.includes("session-token"));
  assert(response.ok && sessionCookie, `Không đăng nhập được ${identifier}.`);
  return `${csrfCookie}; ${sessionCookie}`;
}

async function postAnswers(cookie: string, attemptId: string) {
  return fetch(`${baseUrl}/api/exams/attempts/${attemptId}/answers`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      attemptId,
      changes: [
        { questionNumber: 1, selectedAnswer: "B", changedAt: new Date().toISOString() },
        { questionNumber: 2, selectedAnswer: "A", changedAt: new Date().toISOString() },
      ],
    }),
  });
}

async function main() {
  const unitGrade = gradeExam(
    [
      { id: "q1", number: 1, correctAnswer: "B", points: 1 },
      { id: "q2", number: 2, correctAnswer: "C", points: 1 },
    ],
    new Map([
      [1, " b "],
      [2, "A"],
    ]),
  );
  assert(unitGrade.score === 5 && unitGrade.correctCount === 1, "Unit grading sai.");

  const demoStudent = await db.user.findUnique({ where: { email: demoEmail } });
  const demoExam = await db.exam.findUnique({ where: { id: demoExamId } });
  assert(demoStudent && demoExam, "Thiếu dữ liệu demo. Hãy chạy npm run seed.");
  const originalAvailability = {
    isForever: demoExam.isForever,
    availableFrom: demoExam.availableFrom,
    availableTo: demoExam.availableTo,
  };
  await db.exam.update({
    where: { id: demoExam.id },
    data: { isForever: true, availableFrom: null, availableTo: null },
  });

  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const outsiderPassword = "SliceOneOutsider123!";
  const outsider = await db.user.create({
    data: {
      name: "Outsider Slice 1",
      email: `slice1-outsider-${suffix}@example.test`,
      studentPhone: `07${String(Date.now()).slice(-8)}`,
      parentPhone: `06${String(Date.now()).slice(-8)}`,
      passwordHash: await hashPassword(outsiderPassword),
      role: "STUDENT",
      status: "ACTIVE",
    },
  });
  const attempt = await db.examAttempt.create({
    data: {
      examId: demoExam.id,
      userId: demoStudent.id,
      openKey: `verify:${suffix}`,
      mode: demoExam.mode,
      expiresAt: new Date(Date.now() + 20 * 60_000),
    },
  });

  try {
    await db.classEnrollment.create({
      data: { classId: "slice1-demo-class", studentId: outsider.id },
    });
    const [startA, startB] = await Promise.all([
      startAttemptForUser(demoExam.id, outsider.id),
      startAttemptForUser(demoExam.id, outsider.id),
    ]);
    assert(
      startA.attemptId === startB.attemptId,
      "Hai request bắt đầu đồng thời phải dùng chung một attempt đang mở.",
    );

    const [demoCookie, outsiderCookie] = await Promise.all([
      signInCredentials(demoEmail, demoPassword),
      signInCredentials(outsider.email, outsiderPassword),
    ]);

    const forbiddenSave = await postAnswers(outsiderCookie, attempt.id);
    assert(forbiddenSave.status === 404, "Tài khoản khác phải bị chặn autosave.");

    const saved = await postAnswers(demoCookie, attempt.id);
    assert(saved.ok, "Chủ sở hữu phải autosave được.");
    const savedHistory = await db.answerHistory.findMany({
      where: { attemptId: attempt.id },
      orderBy: [{ changedAt: "asc" }, { id: "asc" }],
    });
    const latest = new Map<number, string>();
    for (const answer of savedHistory) {
      latest.set(answer.questionNumber, answer.selectedAnswer);
    }
    assert(latest.get(1) === "B" && latest.get(2) === "A", "Reload không khôi phục đúng.");

    const takingPage = await fetch(
      `${baseUrl}/thi-thu/${demoExam.id}?attemptId=${attempt.id}`,
      { headers: { cookie: demoCookie } },
    );
    const takingHtml = await takingPage.text();
    assert(takingPage.ok && takingHtml.includes(demoExam.title), "Trang làm bài không render.");
    assert(!takingHtml.includes("correctAnswer"), "Answer key bị lộ ở trang làm bài.");

    const firstSubmit = await submitAttemptForUser(attempt.id, demoStudent.id);
    const secondSubmit = await submitAttemptForUser(attempt.id, demoStudent.id);
    assert(firstSubmit.score === 1 && secondSubmit.score === 1, "Nộp idempotent/điểm sai.");

    const snapshot = await db.examAttempt.findUnique({
      where: { id: attempt.id },
      include: { finalizedAnswers: true },
    });
    assert(
      snapshot?.correctCount === 1 &&
        snapshot.incorrectCount === 1 &&
        snapshot.unansweredCount === 8 &&
        snapshot.finalizedAnswers.length === 10,
      "Snapshot chấm điểm không đầy đủ.",
    );

    const lateSave = await postAnswers(demoCookie, attempt.id);
    assert(lateSave.status === 409, "Bài đã nộp phải chặn autosave muộn.");

    const resultPage = await fetch(
      `${baseUrl}/thi-thu/${demoExam.id}/result?attemptId=${attempt.id}`,
      { headers: { cookie: demoCookie } },
    );
    const resultHtml = await resultPage.text();
    assert(
      resultPage.ok && resultHtml.includes("1.00") && resultHtml.includes("Kết quả bài thi"),
      `Trang kết quả sai (HTTP ${resultPage.status}).`,
    );

    const outsiderResult = await fetch(
      `${baseUrl}/thi-thu/${demoExam.id}/result?attemptId=${attempt.id}`,
      { headers: { cookie: outsiderCookie }, redirect: "manual" },
    );
    assert(outsiderResult.status === 404, "Tài khoản khác không được xem kết quả.");

    console.log("✓ Slice 1: ownership, autosave/reload, chấm điểm và idempotency đều đạt.");
  } finally {
    await db.examAttempt.delete({ where: { id: attempt.id } });
    await db.user.delete({ where: { id: outsider.id } });
    await db.exam.update({ where: { id: demoExam.id }, data: originalAvailability });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
