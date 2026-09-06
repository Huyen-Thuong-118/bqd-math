"use client";

import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createManualExam } from "../admin-actions";
import type { ExamQuestionType } from "../types";
import { InlineExamFolderCreator } from "./InlineExamFolderCreator";

type ClassOption = { id: string; name: string; code: string; level: string };
type FolderOption = { id: string; label: string };
type DraftQuestion = {
  id: string;
  type: ExamQuestionType;
  content: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
};

const input = "mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600 outline-none focus:border-navy-400";

function newQuestion(type: ExamQuestionType = "MULTIPLE_CHOICE"): DraftQuestion {
  return {
    id: crypto.randomUUID(),
    type,
    content: "",
    options: type === "SHORT_ANSWER" ? [] : ["", "", "", ""],
    correctAnswer: type === "TRUE_FALSE" ? "D,D,D,D" : type === "MULTIPLE_CHOICE" ? "A" : "",
    explanation: "",
    points: type === "MULTIPLE_CHOICE" ? 0.25 : type === "TRUE_FALSE" ? 1 : 0.5,
  };
}

export function ManualExamForm({ classes, folders }: { classes: ClassOption[]; folders: FolderOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<"MOCK" | "PRACTICE">("MOCK");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => [newQuestion()]);
  const totalPoints = useMemo(() => questions.reduce((sum, question) => sum + (Number(question.points) || 0), 0), [questions]);

  function update(id: string, patch: Partial<DraftQuestion>) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question));
  }

  function changeType(question: DraftQuestion, type: ExamQuestionType) {
    const replacement = newQuestion(type);
    update(question.id, {
      type,
      options: replacement.options,
      correctAnswer: replacement.correctAnswer,
      points: replacement.points,
    });
  }

  function move(index: number, direction: -1 | 1) {
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function submit(data: FormData) {
    setError(undefined);
    data.set("questions", JSON.stringify(questions.map((question) => ({
      type: question.type,
      content: question.content,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      points: question.points,
    }))));
    startTransition(async () => {
      const result = await createManualExam(data);
      if (!result.success) return setError(result.error);
      router.push("/admin/de-thi");
      router.refresh();
    });
  }

  return (
    <details className="rounded-3xl border border-navy-100 bg-white p-5">
      <summary className="cursor-pointer font-semibold text-navy-600">3. Nhập câu hỏi thủ công — không cần PDF</summary>
      <form action={submit} className="mt-5 space-y-5">
        <section className="grid gap-3 rounded-2xl bg-pastel-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm text-navy-500 sm:col-span-2">Tên đề<input name="title" required minLength={3} maxLength={150} className={input} /></label>
          <label className="text-sm text-navy-500">Thư mục<select name="folderId" className={input}><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label>
          <InlineExamFolderCreator folders={folders} />
          <label className="text-sm text-navy-500">Chế độ<select name="mode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className={input}><option value="MOCK">Thi thử</option><option value="PRACTICE">Luyện tập</option></select></label>
          {mode === "MOCK" && <label className="text-sm text-navy-500">Thời lượng (phút)<input name="durationMinutes" type="number" min={1} defaultValue={45} required className={input} /></label>}
          <label className="text-sm text-navy-500">Số lượt tối đa<input name="maxAttempts" type="number" min={1} placeholder="Không giới hạn" className={input} /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-green-800"><input name="publishNow" type="checkbox" defaultChecked /> Xuất bản ngay</label>
        </section>

        <fieldset>
          <legend className="text-sm font-semibold text-navy-500">Giao cho lớp</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {classes.map((item) => <label key={item.id} className="flex min-h-11 items-center gap-2 rounded-xl bg-pastel-50 px-3 py-2 text-xs text-navy-500"><input name="classIds" value={item.id} type="checkbox" />{item.code} · {item.name} · {item.level === "ADVANCED" ? "Nâng cao" : "Cơ bản"}</label>)}
          </div>
        </fieldset>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-semibold text-navy-600">Câu hỏi</h3><p className="text-xs text-navy-300">{questions.length} câu · tổng {totalPoints.toLocaleString("vi-VN")} điểm thô (kết quả quy về thang 10)</p></div>
            <button type="button" onClick={() => setQuestions((current) => [...current, newQuestion()])} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy-600 px-4 py-2 text-xs font-semibold text-white"><Plus className="size-4" />Thêm câu</button>
          </div>
          {questions.map((question, index) => (
            <article key={question.id} className="rounded-2xl border border-navy-100 p-4">
              <div className="flex items-center gap-2">
                <strong className="text-sm text-navy-600">Câu {index + 1}</strong>
                <div className="ml-auto flex gap-1">
                  <IconButton label="Đưa lên" disabled={index === 0 || pending} onClick={() => move(index, -1)}><ArrowUp /></IconButton>
                  <IconButton label="Đưa xuống" disabled={index === questions.length - 1 || pending} onClick={() => move(index, 1)}><ArrowDown /></IconButton>
                  <IconButton label="Xóa câu" disabled={questions.length === 1 || pending} danger onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}><Trash2 /></IconButton>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-navy-400">Loại câu<select value={question.type} onChange={(event) => changeType(question, event.target.value as ExamQuestionType)} className={input}><option value="MULTIPLE_CHOICE">Trắc nghiệm</option><option value="TRUE_FALSE">Đúng / Sai</option><option value="SHORT_ANSWER">Trả lời ngắn</option></select></label>
                <label className="text-xs text-navy-400">Điểm<input value={question.points} onChange={(event) => update(question.id, { points: Number(event.target.value) })} type="number" min="0.01" max="100" step="0.01" className={input} /></label>
                <label className="text-xs text-navy-400 sm:col-span-2">Nội dung<textarea value={question.content} onChange={(event) => update(question.id, { content: event.target.value })} required maxLength={4000} rows={3} className={input} /></label>
                {question.type !== "SHORT_ANSWER" && question.options.map((option, optionIndex) => (
                  <label key={optionIndex} className="text-xs text-navy-400">{question.type === "MULTIPLE_CHOICE" ? `Lựa chọn ${String.fromCharCode(65 + optionIndex)}` : `Mệnh đề ${String.fromCharCode(97 + optionIndex)}`}<input value={option} onChange={(event) => update(question.id, { options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? event.target.value : item) })} required maxLength={1000} className={input} /></label>
                ))}
                {question.type === "MULTIPLE_CHOICE" && <label className="text-xs text-navy-400">Đáp án đúng<select value={question.correctAnswer} onChange={(event) => update(question.id, { correctAnswer: event.target.value })} className={input}>{["A", "B", "C", "D"].map((answer) => <option key={answer}>{answer}</option>)}</select></label>}
                {question.type === "TRUE_FALSE" && <div className="sm:col-span-2"><p className="text-xs text-navy-400">Đáp án từng mệnh đề</p><div className="mt-1 grid grid-cols-4 gap-2">{question.correctAnswer.split(",").map((answer, answerIndex) => <label key={answerIndex} className="text-center text-xs text-navy-400">{String.fromCharCode(97 + answerIndex)}<select value={answer} onChange={(event) => { const values = question.correctAnswer.split(","); values[answerIndex] = event.target.value; update(question.id, { correctAnswer: values.join(",") }); }} className={input}><option value="D">Đúng</option><option value="S">Sai</option></select></label>)}</div></div>}
                {question.type === "SHORT_ANSWER" && <label className="text-xs text-navy-400">Đáp án ngắn<input value={question.correctAnswer} onChange={(event) => update(question.id, { correctAnswer: event.target.value })} required maxLength={50} className={input} /></label>}
                <label className="text-xs text-navy-400 sm:col-span-2">Lời giải (không bắt buộc)<textarea value={question.explanation} onChange={(event) => update(question.id, { explanation: event.target.value })} maxLength={10000} rows={2} className={input} /></label>
              </div>
            </article>
          ))}
        </section>

        <details className="rounded-2xl bg-pastel-50 p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy-500"><Eye className="size-4" />Xem trước nội dung</summary>
          <div className="mt-3 space-y-3">{questions.map((question, index) => <div key={question.id} className="rounded-xl bg-white p-3 text-sm text-navy-500"><strong>Câu {index + 1}. {question.content || "Chưa nhập nội dung"}</strong>{question.options.length > 0 && <ol className="mt-2 grid gap-1 sm:grid-cols-2">{question.options.map((option, optionIndex) => <li key={optionIndex}>{String.fromCharCode(65 + optionIndex)}. {option || "…"}</li>)}</ol>}</div>)}</div>
        </details>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <button disabled={pending || !classes.length || !questions.length} className="min-h-11 rounded-full bg-navy-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Đang tạo…" : "Tạo đề nhập thủ công"}</button>
      </form>
    </details>
  );
}

function IconButton({ label, disabled, onClick, danger = false, children }: { label: string; disabled: boolean; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`flex size-11 items-center justify-center rounded-lg disabled:opacity-25 ${danger ? "text-red-500 hover:bg-red-50" : "text-navy-400 hover:bg-pastel-50"} [&>svg]:size-4`}>{children}</button>;
}
