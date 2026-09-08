import "dotenv/config";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { gradeExam } from "../src/features/exams/grading";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { buildExamDocumentKey, deleteDocument, uploadDocument } from "../src/lib/storage";
import { requireTestDatabase } from "./test-database-guard";

const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function signIn(identifier: string, password: string) {
  const csrf = await fetch(`${baseUrl}/api/auth/csrf`);
  assert(csrf.ok, "Không lấy được CSRF token. Dev server đã chạy chưa?");
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const csrfCookie = csrf.headers.get("set-cookie")?.split(";")[0] ?? "";
  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-auth-return-redirect": "1", cookie: csrfCookie },
    body: new URLSearchParams({ identifier, password, csrfToken, callbackUrl: `${baseUrl}/thi-thu` }),
  });
  const sessionCookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).find((value) => value.includes("session-token"));
  assert(response.ok && sessionCookie, "Không đăng nhập được tài khoản test.");
  return `${csrfCookie}; ${sessionCookie}`;
}

async function main() {
  requireTestDatabase();
  const partialTrueFalse = gradeExam(
    [{ id: "tf", number: 1, type: "TRUE_FALSE", correctAnswer: "D,D,S,S", points: 1 }],
    new Map([[1, "D,D,S,D"]]),
  );
  assert(partialTrueFalse.score === 5, "Chấm điểm từng ý đúng/sai chưa đúng chuẩn 3/4 ý.");

  const samplePdf = await readFile("data/DeThi/1.pdf");
  const ocrPayload = new FormData();
  ocrPayload.set("file", new Blob([samplePdf], { type: "application/pdf" }), "de-mau.pdf");
  const ocrResponse = await fetch(`${process.env.OCR_SERVICE_URL ?? "http://127.0.0.1:8001"}/analyze`, { method: "POST", body: ocrPayload });
  const ocr = await ocrResponse.json() as { sections?: Array<{ count: number }> };
  assert(ocrResponse.ok && ocr.sections?.map((section) => section.count).join("-") === "12-4-6", "OCR không nhận đúng cấu trúc 12-4-6 của data mẫu.");
  for (const sampleNumber of [1, 2, 3]) {
    const sampleAnswerPdf = await readFile(`data/DapAn/${sampleNumber}.pdf`);
    const answerPayload = new FormData();
    answerPayload.set("file", new Blob([sampleAnswerPdf], { type: "application/pdf" }), `dap-an-${sampleNumber}.pdf`);
    const answerResponse = await fetch(`${process.env.OCR_SERVICE_URL ?? "http://127.0.0.1:8001"}/analyze-answer`, { method: "POST", body: answerPayload });
    const detectedAnswers = await answerResponse.json() as { complete?: boolean; answerKey?: string[] };
    assert(answerResponse.ok && detectedAnswers.complete && detectedAnswers.answerKey?.length === 22, `OCR không nhận đủ 22 đáp án từ file lời giải ${sampleNumber}.pdf.`);
  }

  const suffix = randomUUID().slice(0, 8);
  const examId = `slice2-${suffix}`;
  const classId = `slice2-class-${suffix}`;
  const password = "SliceTwoStudent123!";
  const examKey = buildExamDocumentKey({ examId, filename: "de.pdf" });
  const solutionKey = buildExamDocumentKey({ examId, filename: "dapan.pdf" });
  const pdf = Buffer.from("%PDF-1.4\n%%EOF\n");
  let studentId: string | undefined;

  try {
    let rejectedTraversal = false;
    try { await uploadDocument("../outside.pdf", pdf); } catch { rejectedTraversal = true; }
    assert(rejectedTraversal, "Storage local phải chặn path traversal.");

    await uploadDocument(examKey, pdf);
    await uploadDocument(solutionKey, pdf);
    const student = await db.user.create({
      data: {
        name: "Student Slice 2",
        email: `slice2-${suffix}@example.test`,
        studentPhone: `08${Date.now().toString().slice(-8)}`,
        parentPhone: `09${Date.now().toString().slice(-8)}`,
        passwordHash: await hashPassword(password),
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentId = student.id;
    await db.class.create({ data: { id: classId, name: "Class Slice 2", code: `SLICE2-${suffix.toUpperCase()}`, level: "BASIC", schedule: "Test" } });
    await db.classEnrollment.create({ data: { classId, studentId } });
    await db.exam.create({
      data: {
        id: examId,
        title: "Exam Slice 2",
        examFileUrl: examKey,
        answerFileUrl: solutionKey,
        showAnswer: true,
        allowDownload: false,
        status: "PUBLISHED",
        publishedAt: new Date(),
        examLinks: { create: { classId } },
      },
    });

    const cookie = await signIn(student.email!, password);
    const anonymous = await fetch(`${baseUrl}/api/exams/${examId}/file/exam`);
    assert(anonymous.status === 401, "File phải chặn người chưa đăng nhập.");
    const examFile = await fetch(`${baseUrl}/api/exams/${examId}/file/exam`, { headers: { cookie } });
    assert(examFile.ok && examFile.headers.get("content-type") === "application/pdf", "Học sinh trong lớp phải xem được PDF đề.");
    const download = await fetch(`${baseUrl}/api/exams/${examId}/file/exam?download=1`, { headers: { cookie } });
    assert(download.status === 403, "Phải chặn download khi giáo viên không cho phép.");
    const earlySolution = await fetch(`${baseUrl}/api/exams/${examId}/file/solution`, { headers: { cookie } });
    assert(earlySolution.status === 403, "Phải khóa lời giải trước khi nộp.");

    await db.examAttempt.create({ data: { examId, userId: studentId, mode: "MOCK", submittedAt: new Date(), score: 0 } });
    const solution = await fetch(`${baseUrl}/api/exams/${examId}/file/solution`, { headers: { cookie } });
    assert(solution.ok, "Phải mở lời giải sau khi nộp nếu giáo viên cho phép.");
    await db.exam.update({ where: { id: examId }, data: { showAnswer: false } });
    const hiddenSolution = await fetch(`${baseUrl}/api/exams/${examId}/file/solution`, { headers: { cookie } });
    assert(hiddenSolution.status === 403, "Phải khóa lời giải khi giáo viên tắt.");

    console.log("✓ Slice 2: storage, quyền PDF, khóa download và khóa lời giải đều đạt.");
  } finally {
    await db.exam.deleteMany({ where: { id: examId } });
    await db.class.deleteMany({ where: { id: classId } });
    if (studentId) await db.user.deleteMany({ where: { id: studentId } });
    await deleteDocument(examKey).catch(() => undefined);
    await deleteDocument(solutionKey).catch(() => undefined);
    await db.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
