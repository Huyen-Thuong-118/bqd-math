"use client";

import { Flag } from "lucide-react";
import type { TakingQuestion } from "../types";

function sectionLabel(type: TakingQuestion["type"]) {
  if (type === "MULTIPLE_CHOICE") return "Phần I — Trắc nghiệm";
  if (type === "TRUE_FALSE") return "Phần II — Đúng / Sai";
  return "Phần III — Trả lời ngắn";
}

export function isCompleteAnswer(question: TakingQuestion, value?: string) {
  if (!value) return false;
  if (question.type === "TRUE_FALSE") {
    return value.split(",").length === 4 && value.split(",").every((item) => item === "D" || item === "S");
  }
  return value.trim().length > 0;
}

export function AnswerSheet({ questions, answers, disabled, onAnswer, marked = new Set<number>(), onToggleMarked }: {
  questions: TakingQuestion[];
  answers: Record<number, string>;
  disabled: boolean;
  onAnswer: (questionNumber: number, answer: string) => void;
  marked?: Set<number>;
  onToggleMarked?: (questionNumber: number) => void;
}) {
  const groups = questions.reduce<Array<{ type: TakingQuestion["type"]; questions: TakingQuestion[] }>>((result, question) => {
    const last = result.at(-1);
    if (last?.type === question.type) last.questions.push(question);
    else result.push({ type: question.type, questions: [question] });
    return result;
  }, []);

  return (
    <section className="overflow-hidden rounded-3xl border border-navy-100 bg-white">
      <div className="border-b border-navy-100 px-5 py-4"><h2 className="font-semibold text-navy-600">Phiếu đáp án</h2><p className="mt-1 text-xs text-navy-300">Đáp án được tự động lưu trong lúc làm.</p></div>
      <nav aria-label="Điều hướng nhanh theo câu" className="flex max-h-24 flex-wrap gap-1.5 overflow-auto border-b border-navy-50 p-3">{questions.map((question) => <button type="button" key={question.id} onClick={() => document.getElementById(`answer-${question.number}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className={`size-8 rounded-lg text-xs font-semibold ${marked.has(question.number) ? "bg-amber-100 text-amber-800" : isCompleteAnswer(question, answers[question.number]) ? "bg-navy-600 text-white" : "bg-pastel-50 text-navy-400"}`}>{question.number}</button>)}</nav>
      <div className="max-h-[34rem] space-y-6 overflow-auto p-4 sm:p-5">
        {groups.map((group) => (
          <div key={group.type}>
            <h3 className="mb-3 text-sm font-semibold text-navy-500">{sectionLabel(group.type)}</h3>
            <div className="grid gap-2">
              {group.questions.map((question) => {
                const answer = answers[question.number] ?? (question.type === "TRUE_FALSE" ? ",,," : "");
                return (
                  <div id={`answer-${question.number}`} key={question.id} className={`scroll-mt-40 rounded-2xl p-3 ${marked.has(question.number) ? "bg-amber-50 ring-1 ring-amber-200" : "bg-pastel-50"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isCompleteAnswer(question, answer) ? "bg-navy-600 text-white" : "bg-white text-navy-400"}`}>{question.number}</span>
                      {question.type === "MULTIPLE_CHOICE" && <div className="grid flex-1 grid-cols-4 gap-1">{["A", "B", "C", "D"].map((choice) => <button type="button" disabled={disabled} key={choice} onClick={() => onAnswer(question.number, choice)} className={`rounded-lg border py-1.5 text-xs font-semibold ${answer === choice ? "border-navy-600 bg-navy-600 text-white" : "border-navy-100 bg-white text-navy-400"}`}>{choice}</button>)}</div>}
                      {question.type === "TRUE_FALSE" && <div className="grid flex-1 grid-cols-4 gap-1">{answer.split(",").map((value, index) => <div key={index} className="text-center"><span className="text-[10px] text-navy-300">{String.fromCharCode(97 + index)})</span><div className="mt-1 flex justify-center gap-0.5">{["D", "S"].map((choice) => <button type="button" disabled={disabled} key={choice} aria-label={`${String.fromCharCode(97 + index)} ${choice === "D" ? "đúng" : "sai"}`} onClick={() => { const values = answer.split(","); values[index] = choice; onAnswer(question.number, values.join(",")); }} className={`size-7 rounded-md text-[10px] font-semibold ${value === choice ? "bg-navy-600 text-white" : "bg-white text-navy-400"}`}>{choice === "D" ? "Đ" : "S"}</button>)}</div></div>)}</div>}
                      {question.type === "SHORT_ANSWER" && <input disabled={disabled} value={answer} maxLength={50} onChange={(event) => onAnswer(question.number, event.target.value)} className="min-w-0 flex-1 rounded-xl border border-navy-100 bg-white px-3 py-2 text-sm text-navy-600 outline-none focus:border-navy-400" placeholder="Nhập đáp án" />}
                      <button type="button" disabled={disabled} onClick={() => onToggleMarked?.(question.number)} aria-label={marked.has(question.number) ? `Bỏ đánh dấu câu ${question.number}` : `Đánh dấu xem lại câu ${question.number}`} className={`rounded-lg p-1.5 ${marked.has(question.number) ? "bg-amber-200 text-amber-800" : "bg-white text-navy-300"}`}><Flag className="size-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
