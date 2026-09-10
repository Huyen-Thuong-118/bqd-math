import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/lib/db";
import { uploadDocument } from "../src/lib/storage";

type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";

const DATA_DIRECTORY = path.join(process.cwd(), "data", "BoDeThiThuTHPT2026");
const DOCUMENT_FOLDER_ID = "bqd-documents-thpt-2026";
const EXAM_FOLDER_ID = "bqd-exams-thpt-2026";
const DOCUMENT_ID = "bqd-thpt-2026-tong-hop-8-lan";

const SECTIONS = [
  { label: "Phần I - Trắc nghiệm nhiều phương án", count: 12, type: "MULTIPLE_CHOICE" },
  { label: "Phần II - Trắc nghiệm đúng/sai", count: 4, type: "TRUE_FALSE" },
  { label: "Phần III - Trả lời ngắn", count: 6, type: "SHORT_ANSWER" },
] satisfies { label: string; count: number; type: QuestionType }[];

const EXAMS = [
  {
    round: 1,
    answers: ["C", "B", "D", "A", "B", "D", "B", "A", "B", "A", "B", "D", "S,S,S,D", "D,S,S,D", "S,D,D,D", "D,D,S,D", "4", "2494", "7", "3467", "20.8", "4899"],
  },
  {
    round: 2,
    answers: ["B", "D", "C", "C", "A", "B", "C", "A", "C", "B", "D", "A", "D,S,S,D", "D,D,S,S", "D,S,S,D", "S,D,S,D", "1.5", "3", "54", "9.6", "1720", "36"],
  },
  {
    round: 3,
    answers: ["D", "A", "D", "A", "B", "D", "D", "A", "B", "C", "A", "B", "S,D,S,D", "D,D,D,D", "D,D,D,D", "D,D,D,S", "1088", "0.11", "1.39", "6", "3.7", "2592"],
  },
  {
    round: 4,
    answers: ["C", "D", "D", "B", "B", "D", "D", "D", "A", "A", "B", "B", "D,S,S,D", "S,S,D,D", "D,D,S,S", "D,D,D,S", "551", "1.2", "8.52", "0.05", "28", "2025"],
  },
  {
    round: 5,
    answers: ["A", "A", "B", "B", "C", "B", "A", "D", "D", "A", "A", "B", "S,D,S,S", "D,D,D,D", "D,S,D,D", "D,D,D,S", "36", "9,2", "26,1", "864", "0,17", "538"],
  },
  {
    round: 6,
    answers: ["C", "A", "B", "C", "D", "C", "D", "D", "D", "B", "B", "C", "D,S,S,D", "D,S,S,D", "D,D,S,S", "D,D,S,D", "8", "36", "160", "385", "0.31", "996"],
  },
  {
    round: 7,
    answers: ["D", "A", "C", "A", "C", "B", "D", "C", "C", "A", "D", "B", "S,D,D,D", "D,D,D,D", "S,D,D,D", "D,D,D,S", "0.75", "1109", "12", "206", "19.6", "3327"],
  },
  {
    round: 8,
    answers: ["C", "A", "B", "B", "B", "A", "D", "B", "B", "A", "D", "B", "D,S,D,S", "D,D,S,D", "D,D,D,D", "D,D,S,S", "1322", "1.52", "1.06", "26.2", "498", "2"],
  },
] as const;

function examId(round: number) {
  return `bqd-thpt-2026-lan-${round}`;
}

function questionType(index: number): QuestionType {
  if (index < 12) return "MULTIPLE_CHOICE";
  if (index < 16) return "TRUE_FALSE";
  return "SHORT_ANSWER";
}

function questionLabel(index: number) {
  if (index < 12) return `Phần I - Câu ${index + 1}`;
  if (index < 16) return `Phần II - Câu ${index - 11}`;
  return `Phần III - Câu ${index - 15}`;
}

async function pdfBytes(fileName: string) {
  const bytes = await readFile(path.join(DATA_DIRECTORY, fileName));
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error(`${fileName} không phải file PDF hợp lệ.`);
  }
  return bytes;
}

async function main() {
  const expectedQuestionCount = SECTIONS.reduce((sum, section) => sum + section.count, 0);
  for (const exam of EXAMS) {
    if (exam.answers.length !== expectedQuestionCount) {
      throw new Error(`Lần ${exam.round} có ${exam.answers.length}/${expectedQuestionCount} đáp án.`);
    }
  }

  const activeClasses = await db.class.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (activeClasses.length === 0) {
    throw new Error("Chưa có lớp đang hoạt động để giao tài liệu và đề thi.");
  }
  const classIds = activeClasses.map((item) => item.id);

  const documentKey = `documents/${DOCUMENT_ID}/v1/file.pdf`;
  const documentBytes = await pdfBytes("tong-hop-8-lan-thi-thu.pdf");
  await uploadDocument(documentKey, documentBytes, "application/pdf");

  for (const exam of EXAMS) {
    const id = examId(exam.round);
    const [examBytes, answerBytes] = await Promise.all([
      pdfBytes(`de-thi-thu-lan-${exam.round}.pdf`),
      pdfBytes(`loi-giai-lan-${exam.round}.pdf`),
    ]);
    await Promise.all([
      uploadDocument(`exams/${id}/de.pdf`, examBytes, "application/pdf"),
      uploadDocument(`exams/${id}/dapan.pdf`, answerBytes, "application/pdf"),
    ]);
  }

  await db.$transaction(async (transaction) => {
    await transaction.folder.upsert({
      where: { id: DOCUMENT_FOLDER_ID },
      update: { name: "Ôn thi TN THPT 2026", kind: "DOCUMENT", position: 0 },
      create: { id: DOCUMENT_FOLDER_ID, name: "Ôn thi TN THPT 2026", kind: "DOCUMENT", position: 0 },
    });
    await transaction.folder.upsert({
      where: { id: EXAM_FOLDER_ID },
      update: { name: "Thi thử TN THPT 2026", kind: "EXAM", position: 0 },
      create: { id: EXAM_FOLDER_ID, name: "Thi thử TN THPT 2026", kind: "EXAM", position: 0 },
    });

    await transaction.document.upsert({
      where: { id: DOCUMENT_ID },
      update: {
        title: "Tổng hợp 8 lần thi thử TN THPT 2026 - Môn Toán",
        fileUrl: documentKey,
        fileName: "tong-hop-8-lan-thi-thu.pdf",
        contentType: "application/pdf",
        folderId: DOCUMENT_FOLDER_ID,
        position: 0,
        allowDownload: false,
      },
      create: {
        id: DOCUMENT_ID,
        title: "Tổng hợp 8 lần thi thử TN THPT 2026 - Môn Toán",
        fileUrl: documentKey,
        fileName: "tong-hop-8-lan-thi-thu.pdf",
        contentType: "application/pdf",
        folderId: DOCUMENT_FOLDER_ID,
        position: 0,
        allowDownload: false,
      },
    });
    await transaction.documentVersion.upsert({
      where: { documentId_version: { documentId: DOCUMENT_ID, version: 1 } },
      update: { fileUrl: documentKey, fileName: "tong-hop-8-lan-thi-thu.pdf", contentType: "application/pdf" },
      create: { documentId: DOCUMENT_ID, version: 1, fileUrl: documentKey, fileName: "tong-hop-8-lan-thi-thu.pdf", contentType: "application/pdf" },
    });
    await transaction.documentClass.deleteMany({ where: { documentId: DOCUMENT_ID } });
    await transaction.documentClass.createMany({
      data: classIds.map((classId) => ({ documentId: DOCUMENT_ID, classId })),
    });

    for (const exam of EXAMS) {
      const id = examId(exam.round);
      const current = await transaction.exam.findUnique({
        where: { id },
        select: { publishedAt: true },
      });
      await transaction.exam.upsert({
        where: { id },
        update: {
          title: `Đề thi thử TN THPT 2026 - Lần ${exam.round}`,
          source: "PDF",
          mode: "MOCK",
          status: "PUBLISHED",
          publishedAt: current?.publishedAt ?? new Date(),
          folderId: EXAM_FOLDER_ID,
          position: exam.round - 1,
          examFileUrl: `exams/${id}/de.pdf`,
          answerFileUrl: `exams/${id}/dapan.pdf`,
          showAnswer: true,
          allowDownload: false,
          isForever: true,
          availableFrom: null,
          availableTo: null,
          durationMinutes: 90,
          maxAttempts: 3,
          answerSheetConfig: SECTIONS,
          scoringPolicy: {
            trueFalseFractions: [0, 0.1, 0.25, 0.5, 1],
            pointByType: { MULTIPLE_CHOICE: 0.25, TRUE_FALSE: 1, SHORT_ANSWER: 0.5 },
          },
        },
        create: {
          id,
          title: `Đề thi thử TN THPT 2026 - Lần ${exam.round}`,
          source: "PDF",
          mode: "MOCK",
          status: "PUBLISHED",
          publishedAt: new Date(),
          folderId: EXAM_FOLDER_ID,
          position: exam.round - 1,
          examFileUrl: `exams/${id}/de.pdf`,
          answerFileUrl: `exams/${id}/dapan.pdf`,
          showAnswer: true,
          allowDownload: false,
          isForever: true,
          durationMinutes: 90,
          maxAttempts: 3,
          answerSheetConfig: SECTIONS,
          scoringPolicy: {
            trueFalseFractions: [0, 0.1, 0.25, 0.5, 1],
            pointByType: { MULTIPLE_CHOICE: 0.25, TRUE_FALSE: 1, SHORT_ANSWER: 0.5 },
          },
        },
      });

      await transaction.examClass.deleteMany({ where: { examId: id } });
      await transaction.examClass.createMany({
        data: classIds.map((classId) => ({ examId: id, classId })),
      });

      for (const [index, correctAnswer] of exam.answers.entries()) {
        const type = questionType(index);
        await transaction.examQuestion.upsert({
          where: { examId_number: { examId: id, number: index + 1 } },
          update: {
            type,
            content: `${questionLabel(index)} - xem nội dung trong file đề`,
            options: type === "MULTIPLE_CHOICE" ? ["A", "B", "C", "D"] : type === "TRUE_FALSE" ? ["a", "b", "c", "d"] : [],
            correctAnswer,
            points: type === "MULTIPLE_CHOICE" ? 0.25 : type === "TRUE_FALSE" ? 1 : 0.5,
          },
          create: {
            examId: id,
            number: index + 1,
            type,
            content: `${questionLabel(index)} - xem nội dung trong file đề`,
            options: type === "MULTIPLE_CHOICE" ? ["A", "B", "C", "D"] : type === "TRUE_FALSE" ? ["a", "b", "c", "d"] : [],
            correctAnswer,
            points: type === "MULTIPLE_CHOICE" ? 0.25 : type === "TRUE_FALSE" ? 1 : 0.5,
          },
        });
      }
      await transaction.examQuestion.deleteMany({
        where: { examId: id, number: { gt: expectedQuestionCount } },
      });
    }
  }, { timeout: 60_000 });

  console.log(`Đã thêm 1 tài liệu và ${EXAMS.length} đề thi cho ${activeClasses.length} lớp đang hoạt động:`);
  for (const item of activeClasses) console.log(`- ${item.name}`);
}

main()
  .catch((error) => {
    console.error("Import dữ liệu thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
