import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireActiveAdminId } from "@/features/exams/admin";
import { ExamEditForm } from "@/features/exams/components/ExamEditForm";
import type { ExamQuestionType } from "@/features/exams/types";
import { db } from "@/lib/db";
import { isCloudStorageConfigured } from "@/lib/storage";

export const metadata: Metadata = { title: "Chỉnh sửa đề thi | BQD Math" };
export const dynamic = "force-dynamic";

function dateTimeLocal(date: Date | null) {
  if (!date) return "";
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date).replace(" ", "T");
}

function scoringValues(value: unknown) {
  const fallback = {
    points: { MULTIPLE_CHOICE: 0.25, TRUE_FALSE: 1, SHORT_ANSWER: 0.5 },
    trueFalsePolicy: "STANDARD" as const,
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const policy = value as Record<string, unknown>;
  const pointByType = policy.pointByType;
  const fractions = policy.trueFalseFractions;
  const points = { ...fallback.points };
  if (pointByType && typeof pointByType === "object" && !Array.isArray(pointByType)) {
    for (const type of ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] as ExamQuestionType[]) {
      const point = Number((pointByType as Record<string, unknown>)[type]);
      if (Number.isFinite(point) && point > 0) points[type] = point;
    }
  }
  return {
    points,
    trueFalsePolicy: Array.isArray(fractions) && fractions.slice(0, 4).every((item) => Number(item) === 0)
      ? "ALL_OR_NOTHING" as const
      : "STANDARD" as const,
  };
}

function folderOptions(rows: { id: string; name: string; parentId: string | null }[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => {
    const names = [row.name];
    let parentId = row.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parent.parentId;
    }
    return { id: row.id, label: names.join(" / ") };
  }).sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

export default async function EditExamPage({ params }: { params: Promise<{ examId: string }> }) {
  await requireActiveAdminId();
  const { examId } = await params;
  const [exam, classes, folderRows] = await Promise.all([
    db.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        title: true,
        source: true,
        folderId: true,
        mode: true,
        status: true,
        durationMinutes: true,
        maxAttempts: true,
        isForever: true,
        availableFrom: true,
        availableTo: true,
        allowDownload: true,
        showAnswer: true,
        hideWrongAnswers: true,
        examFileUrl: true,
        answerFileUrl: true,
        scoringPolicy: true,
        examLinks: { select: { classId: true } },
        questions: { select: { number: true, type: true, content: true, options: true, correctAnswer: true, explanation: true, points: true }, orderBy: { number: "asc" } },
        _count: { select: { attempts: true } },
      },
    }),
    db.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true, level: true }, orderBy: { name: "asc" } }),
    db.folder.findMany({ where: { kind: "EXAM" }, select: { id: true, name: true, parentId: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);
  if (!exam) notFound();
  const scoring = scoringValues(exam.scoringPolicy);
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div><h1 className="text-xl font-semibold text-navy-600">Chỉnh sửa đề thi</h1><p className="mt-1 text-sm text-navy-300">Cập nhật cấu hình, lớp được giao, file PDF, đáp án và thang điểm.</p></div>
      <ExamEditForm
        classes={classes}
        folders={folderOptions(folderRows)}
        directUpload={isCloudStorageConfigured()}
        storageWarning={!isCloudStorageConfigured() && process.env.NODE_ENV === "production"}
        exam={{
          id: exam.id,
          title: exam.title,
          source: exam.source,
          folderId: exam.folderId,
          mode: exam.mode,
          status: exam.status,
          durationMinutes: exam.durationMinutes,
          maxAttempts: exam.maxAttempts,
          isForever: exam.isForever,
          availableFrom: dateTimeLocal(exam.availableFrom),
          availableTo: dateTimeLocal(exam.availableTo),
          allowDownload: exam.allowDownload,
          showAnswer: exam.showAnswer,
          hideWrongAnswers: exam.hideWrongAnswers,
          hasExamPdf: Boolean(exam.examFileUrl),
          hasSolution: Boolean(exam.answerFileUrl),
          classIds: exam.examLinks.map((link) => link.classId),
          attemptCount: exam._count.attempts,
          questions: exam.questions.map((question) => ({
            ...question,
            options: Array.isArray(question.options) ? question.options.filter((item): item is string => typeof item === "string") : [],
            correctAnswer: question.type === "TRUE_FALSE" && question.correctAnswer.split(",").length !== 4 ? ",,," : question.correctAnswer,
          })),
          ...scoring,
        }}
      />
    </section>
  );
}
