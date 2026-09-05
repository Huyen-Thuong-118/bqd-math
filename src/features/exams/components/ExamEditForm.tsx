"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { discardExamUpload, updateExam } from "../admin-actions";
import type { ExamQuestionType } from "../types";
import { uploadExamPdf } from "./exam-upload";

type ClassOption = { id: string; name: string; level: string };
type EditableQuestion = { number: number; type: ExamQuestionType; correctAnswer: string };
type EditableExam = {
  id: string;
  title: string;
  mode: "MOCK" | "PRACTICE";
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  durationMinutes: number | null;
  maxAttempts: number | null;
  isForever: boolean;
  availableFrom: string;
  availableTo: string;
  allowDownload: boolean;
  showAnswer: boolean;
  hideWrongAnswers: boolean;
  hasExamPdf: boolean;
  hasSolution: boolean;
  classIds: string[];
  attemptCount: number;
  questions: EditableQuestion[];
  points: Record<ExamQuestionType, number>;
  trueFalsePolicy: "STANDARD" | "ALL_OR_NOTHING";
};

const input = "mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600 outline-none focus:border-navy-400";

export function ExamEditForm({ exam, classes, directUpload }: { exam: EditableExam; classes: ClassOption[]; directUpload: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState(exam.mode);
  const [isForever, setIsForever] = useState(exam.isForever);
  const [answers, setAnswers] = useState(exam.questions.map((question) => question.correctAnswer));

  function setAnswer(index: number, value: string) {
    setAnswers((current) => current.map((answer, itemIndex) => itemIndex === index ? value : answer));
  }

  function submit(formData: FormData) {
    setError(undefined);
    formData.set("answerKey", JSON.stringify(answers));
    startTransition(async () => {
      const uploadedKeys: string[] = [];
      if (directUpload) {
        try {
          const examPdf = formData.get("examPdf");
          const answerPdf = formData.get("answerPdf");
          if (examPdf instanceof File && examPdf.size > 0) {
            const key = await uploadExamPdf({
              examId: exam.id,
              kind: "exam",
              file: examPdf,
              revisionId: crypto.randomUUID(),
            });
            uploadedKeys.push(key);
            formData.set("examPdfKey", key);
          }
          if (answerPdf instanceof File && answerPdf.size > 0) {
            const key = await uploadExamPdf({
              examId: exam.id,
              kind: "answer",
              file: answerPdf,
              revisionId: crypto.randomUUID(),
            });
            uploadedKeys.push(key);
            formData.set("answerPdfKey", key);
          }
          formData.delete("examPdf");
          formData.delete("answerPdf");
        } catch (error) {
          await Promise.all(uploadedKeys.map((key) => discardExamUpload(exam.id, key)));
          return setError(error instanceof Error ? error.message : "Không thể upload PDF.");
        }
      }
      const result = await updateExam(exam.id, formData);
      if (!result.success) {
        await Promise.all(uploadedKeys.map((key) => discardExamUpload(exam.id, key)));
        return setError(result.error);
      }
      router.push("/admin/de-thi");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-6">
      {!directUpload && <p className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">Chưa cấu hình Cloudflare R2. Không nên thay file đề trên môi trường production cho tới khi storage được cấu hình đầy đủ.</p>}
      {exam.attemptCount > 0 && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Đề đã có {exam.attemptCount} lượt làm. Điểm và đáp án của các bài đã nộp được giữ nguyên theo bản chụp; thay đổi mới chỉ áp dụng cho lượt nộp sau.</p>}
      <fieldset disabled={pending} className="space-y-6 disabled:opacity-70">
        <section className="grid gap-4 rounded-3xl border border-navy-100 bg-white p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-navy-300">{exam.status === "DRAFT" ? "Bản nháp" : exam.status === "PUBLISHED" ? "Đã xuất bản" : "Đã đóng"}</p><h2 className="mt-1 font-semibold text-navy-600">Thông tin đề</h2></div>
          <label className="text-sm font-medium text-navy-500 sm:col-span-2">Tên đề<input name="title" required minLength={3} maxLength={150} defaultValue={exam.title} className={input} /></label>
          <label className="text-sm font-medium text-navy-500">Thay file đề PDF {exam.hasExamPdf ? "(bỏ trống để giữ file cũ)" : "(hiện là đề từ ngân hàng câu hỏi)"}<input name="examPdf" type="file" accept="application/pdf,.pdf" className={input} /></label>
          <label className="text-sm font-medium text-navy-500">Thay/thêm file lời giải PDF<input name="answerPdf" type="file" accept="application/pdf,.pdf" className={input} /></label>
          {exam.hasSolution && <label className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2"><input name="removeSolution" type="checkbox" />Xóa file lời giải hiện tại</label>}
        </section>

        <section className="grid gap-4 rounded-3xl border border-navy-100 bg-white p-5 sm:grid-cols-2">
          <h2 className="font-semibold text-navy-600 sm:col-span-2">Cài đặt giao đề</h2>
          <label className="text-sm font-medium text-navy-500">Chế độ<select name="mode" value={mode} onChange={(event) => setMode(event.target.value as "MOCK" | "PRACTICE")} className={input}><option value="MOCK">Thi thử có đồng hồ</option><option value="PRACTICE">Luyện tập không giới hạn giờ</option></select></label>
          <label className="text-sm font-medium text-navy-500">Thời lượng (phút)<input name="durationMinutes" type="number" min={1} required={mode === "MOCK"} disabled={mode !== "MOCK"} defaultValue={exam.durationMinutes ?? 90} className={input} /></label>
          <label className="text-sm font-medium text-navy-500">Số lượt làm tối đa<input name="maxAttempts" type="number" min={1} defaultValue={exam.maxAttempts ?? ""} placeholder="Để trống = không giới hạn" className={input} /></label>
          <div className="rounded-xl bg-pastel-50 p-3 text-sm"><label className="flex items-center gap-2 font-medium text-navy-500"><input name="isForever" type="checkbox" checked={isForever} onChange={(event) => setIsForever(event.target.checked)} />Mở vĩnh viễn</label></div>
          {!isForever && <><label className="text-sm font-medium text-navy-500">Mở từ<input name="availableFrom" required type="datetime-local" defaultValue={exam.availableFrom} className={input} /></label><label className="text-sm font-medium text-navy-500">Đóng lúc<input name="availableTo" required type="datetime-local" defaultValue={exam.availableTo} className={input} /></label></>}
          <div className="grid gap-3 text-sm text-navy-500 sm:col-span-2 sm:grid-cols-3"><label className="flex gap-2"><input name="allowDownload" type="checkbox" defaultChecked={exam.allowDownload} /> Cho phép tải PDF</label><label className="flex gap-2"><input name="showAnswer" type="checkbox" defaultChecked={exam.showAnswer} /> Hiện lời giải sau khi nộp</label><label className="flex gap-2"><input name="hideWrongAnswers" type="checkbox" defaultChecked={exam.hideWrongAnswers} /> Ẩn đáp án đúng nếu làm sai</label></div>
          <fieldset className="sm:col-span-2"><legend className="text-sm font-medium text-navy-500">Giao cho lớp</legend><div className="mt-2 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{classes.map((item) => <label key={item.id} className="flex gap-2 rounded-xl border border-navy-100 p-3 text-sm text-navy-500"><input name="classIds" value={item.id} type="checkbox" defaultChecked={exam.classIds.includes(item.id)} />{item.name} · {item.level === "ADVANCED" ? "Nâng cao" : "Cơ bản"}</label>)}</div></fieldset>
        </section>

        <section className="space-y-4 rounded-3xl border border-navy-100 bg-white p-5">
          <div><h2 className="font-semibold text-navy-600">Đáp án và thang điểm</h2><p className="mt-1 text-sm text-navy-300">Có thể sửa key chấm tự động mà không làm đổi kết quả các bài đã nộp.</p></div>
          <div className="grid gap-3 sm:grid-cols-4"><label className="text-xs text-navy-400">Điểm/câu trắc nghiệm<input className={input} name="multipleChoicePoints" type="number" min="0.01" step="0.01" defaultValue={exam.points.MULTIPLE_CHOICE} /></label><label className="text-xs text-navy-400">Điểm/câu đúng-sai<input className={input} name="trueFalsePoints" type="number" min="0.01" step="0.01" defaultValue={exam.points.TRUE_FALSE} /></label><label className="text-xs text-navy-400">Điểm/câu trả lời ngắn<input className={input} name="shortAnswerPoints" type="number" min="0.01" step="0.01" defaultValue={exam.points.SHORT_ANSWER} /></label><label className="text-xs text-navy-400">Chính sách đúng-sai<select className={input} name="trueFalsePolicy" defaultValue={exam.trueFalsePolicy}><option value="STANDARD">0 / 0,1 / 0,25 / 0,5 / 1</option><option value="ALL_OR_NOTHING">Đúng hết mới có điểm</option></select></label></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exam.questions.map((question, index) => <div key={question.number} className="rounded-2xl bg-pastel-50 p-3 text-xs font-semibold text-navy-400"><p>Câu {question.number}</p>{question.type === "MULTIPLE_CHOICE" ? <select required value={answers[index]} onChange={(event) => setAnswer(index, event.target.value)} className={input}><option value="">Chọn đáp án</option><option>A</option><option>B</option><option>C</option><option>D</option></select> : question.type === "TRUE_FALSE" ? <div className="mt-2 grid grid-cols-4 gap-1">{answers[index].split(",").map((answer, statementIndex) => <label key={statementIndex} className="text-center">{String.fromCharCode(97 + statementIndex)}<select required value={answer} onChange={(event) => { const values = answers[index].split(","); values[statementIndex] = event.target.value; setAnswer(index, values.join(",")); }} className="mt-1 w-full rounded-lg border border-navy-100 bg-white p-1.5"><option value="">—</option><option value="D">Đ</option><option value="S">S</option></select></label>)}</div> : <input required value={answers[index]} maxLength={50} onChange={(event) => setAnswer(index, event.target.value)} className={input} placeholder="Đáp án ngắn" />}</div>)}
          </div>
        </section>
      </fieldset>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-3"><button disabled={pending || !classes.length} className="rounded-full bg-navy-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Đang lưu…" : "Lưu thay đổi"}</button><Link href="/admin/de-thi" className="rounded-full border border-navy-100 px-6 py-3 text-sm font-semibold text-navy-500">Hủy</Link></div>
    </form>
  );
}
