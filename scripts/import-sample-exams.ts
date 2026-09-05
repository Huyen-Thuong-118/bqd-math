import "dotenv/config";

import path from "node:path";
import { copyFile, mkdir } from "node:fs/promises";

import { db } from "../src/lib/db";

const examId = "slice2-sample-exam-1";
const classId = "slice1-demo-class";
const multipleChoice = ["D", "B", "D", "B", "C", "B", "A", "C", "C", "A", "C", "D"];
const trueFalse = ["D,D,S,S", "D,D,D,S", "D,D,S,D", "D,S,S,D"];
const shortAnswer = ["6,19", "17,1", "3456", "3980", "1350", "2656"];

async function main() {
  const targetDirectory = path.join(process.cwd(), "storage", "uploads", "exams", examId);
  await mkdir(targetDirectory, { recursive: true });
  await copyFile(path.join(process.cwd(), "data", "DeThi", "1.pdf"), path.join(targetDirectory, "de.pdf"));
  await copyFile(path.join(process.cwd(), "data", "DapAn", "1.pdf"), path.join(targetDirectory, "dapan.pdf"));

  const demoClass = await db.class.findUnique({ where: { id: classId } });
  if (!demoClass) throw new Error("Thiếu lớp demo. Chạy npm run seed trước.");

  await db.exam.upsert({
    where: { id: examId },
    update: {
      title: "Đề thi tốt nghiệp THPT 2026 — mã 0102",
      examFileUrl: `exams/${examId}/de.pdf`,
      answerFileUrl: `exams/${examId}/dapan.pdf`,
      answerSheetConfig: [
        { label: "Phần I — Trắc nghiệm", type: "MULTIPLE_CHOICE", count: 12 },
        { label: "Phần II — Đúng / Sai", type: "TRUE_FALSE", count: 4 },
        { label: "Phần III — Trả lời ngắn", type: "SHORT_ANSWER", count: 6 },
      ],
    },
    create: {
      id: examId,
      title: "Đề thi tốt nghiệp THPT 2026 — mã 0102",
      mode: "MOCK",
      examFileUrl: `exams/${examId}/de.pdf`,
      answerFileUrl: `exams/${examId}/dapan.pdf`,
      showAnswer: true,
      isForever: true,
      durationMinutes: 90,
      maxAttempts: 3,
      allowDownload: false,
      answerSheetConfig: [
        { label: "Phần I — Trắc nghiệm", type: "MULTIPLE_CHOICE", count: 12 },
        { label: "Phần II — Đúng / Sai", type: "TRUE_FALSE", count: 4 },
        { label: "Phần III — Trả lời ngắn", type: "SHORT_ANSWER", count: 6 },
      ],
    },
  });
  await db.examClass.upsert({ where: { examId_classId: { examId, classId } }, update: {}, create: { examId, classId } });
  const answers = [...multipleChoice, ...trueFalse, ...shortAnswer];
  for (const [index, correctAnswer] of answers.entries()) {
    const number = index + 1;
    const type = number <= 12 ? "MULTIPLE_CHOICE" : number <= 16 ? "TRUE_FALSE" : "SHORT_ANSWER";
    await db.examQuestion.upsert({
      where: { examId_number: { examId, number } },
      update: { type, correctAnswer, options: type === "MULTIPLE_CHOICE" ? ["A", "B", "C", "D"] : type === "TRUE_FALSE" ? ["a", "b", "c", "d"] : [], points: type === "MULTIPLE_CHOICE" ? 0.25 : type === "TRUE_FALSE" ? 1 : 0.5 },
      create: { examId, number, type, content: `Câu ${number} — xem nội dung trong file đề`, correctAnswer, options: type === "MULTIPLE_CHOICE" ? ["A", "B", "C", "D"] : type === "TRUE_FALSE" ? ["a", "b", "c", "d"] : [], points: type === "MULTIPLE_CHOICE" ? 0.25 : type === "TRUE_FALSE" ? 1 : 0.5 },
    });
  }
  await db.examQuestion.deleteMany({ where: { examId, number: { gt: answers.length } } });
  console.log(`✓ Đã import data/DeThi/1.pdf + data/DapAn/1.pdf thành đề mẫu ${examId}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
