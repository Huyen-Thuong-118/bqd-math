"use client";

import { FormEvent, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Loader2,
  RotateCcw,
  SkipForward,
  Upload,
} from "lucide-react";

import { ClassMultiSelect } from "@/components/forms/ClassMultiSelect";
import { MathText } from "@/components/math/MathText";

import { createReviewQuestion } from "../actions";
import type {
  ImportedReviewQuestion,
  ImportedReviewQuestionType,
  ReviewQuestionImportResult,
} from "../import-types";

type Chapter = { id: string; name: string; order: number };
type ClassOption = { id: string; name: string; code: string };
type Difficulty = "EASY" | "MEDIUM" | "HARD";
type DraftStatus = "pending" | "accepted" | "skipped";
type Defaults = {
  chapterId: string;
  classIds: string[];
  grade: string;
  topic: string;
  difficulty: Difficulty;
};

type ImportApiResponse =
  | { success: true; data: ReviewQuestionImportResult }
  | { success?: false; error: string };

const input =
  "mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600 outline-none focus:border-navy-400";

function warningLabel(code: string) {
  const labels: Record<string, string> = {
    answer_not_found: "Chưa tìm thấy đáp án — cần nhập lại trước khi nhận",
    formula_transcription_uncertain: "Công thức cần được đối chiếu với ảnh gốc",
    invalid_answer_latex: "LaTeX trong đáp án chưa hợp lệ",
    invalid_latex: "Có công thức LaTeX chưa hợp lệ",
    option_boundary_uncertain: "Ranh giới các lựa chọn chưa chắc chắn",
    question_spans_pages: "Câu hỏi kéo dài qua nhiều trang",
    scanned_source_page: "Trang nguồn là bản scan",
    true_false_column_uncertain: "Các mệnh đề đúng/sai cần được kiểm tra",
    visual_transcription_failed: "AI đọc ảnh thất bại; đang dùng bản nhận diện dự phòng",
    visual_transcription_required: "Nội dung cần được đối chiếu với ảnh gốc",
    vision_answer_rejected_no_explicit_evidence: "Đã loại đáp án do file không ghi đáp án rõ ràng",
  };
  return labels[code] ?? `Cần kiểm tra: ${code}`;
}

function typeLabel(type: ImportedReviewQuestionType) {
  if (type === "TRUE_FALSE") return "Đúng / Sai";
  if (type === "SHORT_ANSWER") return "Trả lời ngắn";
  return "Trắc nghiệm";
}

export function ReviewQuestionPdfImporter({
  chapters,
  classes,
}: {
  chapters: Chapter[];
  classes: ClassOption[];
}) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ReviewQuestionImportResult>();
  const [defaults, setDefaults] = useState<Defaults>();
  const [statuses, setStatuses] = useState<Record<string, DraftStatus>>({});

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setError("Hãy chọn một file PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File PDF không được vượt quá 20 MB.");
      return;
    }
    setDefaults({
      chapterId: String(form.get("defaultChapterId") || ""),
      classIds: form
        .getAll("defaultClassIds")
        .filter((value): value is string => typeof value === "string"),
      grade: String(form.get("defaultGrade") || ""),
      topic: String(form.get("defaultTopic") || ""),
      difficulty: (form.get("defaultDifficulty") || "MEDIUM") as Difficulty,
    });
    setReading(true);
    setError(undefined);
    setResult(undefined);
    setStatuses({});
    const payload = new FormData();
    payload.set("file", file);
    try {
      const response = await fetch("/api/review-questions/import", {
        method: "POST",
        body: payload,
      });
      const json = (await response.json().catch(() => null)) as ImportApiResponse | null;
      if (!response.ok || !json || !("success" in json) || !json.success) {
        throw new Error(json && "error" in json ? json.error : "Không đọc được file PDF.");
      }
      setResult(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đọc được file PDF.");
    } finally {
      setReading(false);
    }
  }

  const accepted = Object.values(statuses).filter((value) => value === "accepted").length;
  const skipped = Object.values(statuses).filter((value) => value === "skipped").length;

  return (
    <section className="rounded-3xl border border-navy-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-pastel-100 p-3 text-navy-500">
          <FileSearch className="size-6" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold text-navy-600">Nhập câu hỏi từ PDF</h2>
          <p className="mt-1 text-sm leading-relaxed text-navy-300">
            Tải đề lên, kiểm tra bản trích xuất và chỉ nhận những câu bạn đã duyệt.
          </p>
        </div>
      </div>

      <form onSubmit={analyze} className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-navy-400 md:col-span-2">
          File đề PDF
          <input
            className={input}
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            required
          />
        </label>
        <label className="text-xs text-navy-400">
          Chương mặc định
          <select className={input} name="defaultChapterId" defaultValue="">
            <option value="">Chọn khi duyệt từng câu</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.order}. {chapter.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-navy-400">
          Độ khó mặc định
          <select className={input} name="defaultDifficulty" defaultValue="MEDIUM">
            <option value="EASY">Dễ</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HARD">Khó</option>
          </select>
        </label>
        <label className="text-xs text-navy-400">
          Khối mặc định
          <input className={input} name="defaultGrade" placeholder="Ví dụ: 12" />
        </label>
        <label className="text-xs text-navy-400">
          Chủ đề mặc định
          <input className={input} name="defaultTopic" placeholder="Ví dụ: Hàm số" />
        </label>
        <ClassMultiSelect
          classes={classes}
          label="Lớp mặc định"
          name="defaultClassIds"
          className="md:col-span-2"
        />
        <div className="md:col-span-2 xl:col-span-4">
          <button
            disabled={reading}
            className="inline-flex items-center gap-2 rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {reading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {reading ? "Đang đọc và tách câu hỏi…" : "Đọc câu hỏi từ PDF"}
          </button>
          <span className="ml-3 text-xs text-navy-300">Tối đa 20 MB</span>
        </div>
      </form>

      {reading && (
        <p role="status" className="mt-4 rounded-2xl bg-pastel-50 px-4 py-3 text-sm text-navy-500">
          Hệ thống đang render từng trang và nhận diện câu hỏi. File scan có thể mất vài phút.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {result && defaults && (
        <div className="mt-6 border-t border-navy-50 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-navy-600">
                Đã tìm thấy {result.questions.length} câu trong {result.pageCount} trang
              </h3>
              <p className="mt-1 text-xs text-navy-300">
                {result.filename} · Đã nhận {accepted} · Bỏ qua {skipped} · Còn lại{" "}
                {Math.max(0, result.questions.length - accepted - skipped)}
              </p>
            </div>
          </div>
          {result.warnings.length > 0 && (
            <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {result.warnings.map(warningLabel).join(" · ")}
            </div>
          )}
          <div className="mt-4 space-y-4">
            {result.questions.map((question) => (
              <ImportedQuestionCard
                key={question.id}
                question={question}
                chapters={chapters}
                classes={classes}
                defaults={defaults}
                status={statuses[question.id] ?? "pending"}
                onStatus={(status) =>
                  setStatuses((current) => ({ ...current, [question.id]: status }))
                }
              />
            ))}
          </div>
          {result.questions.length === 0 && (
            <p className="mt-4 rounded-2xl border border-dashed border-navy-100 p-8 text-center text-sm text-navy-300">
              Không tìm thấy ranh giới câu hỏi trong file này. Hãy kiểm tra định dạng đánh số câu.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function ImportedQuestionCard({
  question,
  chapters,
  classes,
  defaults,
  status,
  onStatus,
}: {
  question: ImportedReviewQuestion;
  chapters: Chapter[];
  classes: ClassOption[];
  defaults: Defaults;
  status: DraftStatus;
  onStatus: (status: DraftStatus) => void;
}) {
  const [type, setType] = useState(question.type);
  const [content, setContent] = useState(question.content);
  const [options, setOptions] = useState(
    question.options.length || question.type === "SHORT_ANSWER"
      ? question.options
      : ["", "", "", ""],
  );
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer);
  const [textSolution, setTextSolution] = useState(question.textSolution);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (status !== "pending") {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${status === "accepted" ? "bg-green-50 text-green-800" : "bg-slate-50 text-slate-600"}`}>
        <p className="flex items-center gap-2 text-sm font-semibold">
          {status === "accepted" ? (
            <CheckCircle2 className="size-4" aria-hidden />
          ) : (
            <SkipForward className="size-4" aria-hidden />
          )}
          Câu {question.number}: {status === "accepted" ? "Đã nhận vào ngân hàng" : "Đã bỏ qua"}
        </p>
        {status === "skipped" && (
          <button
            type="button"
            onClick={() => onStatus("pending")}
            className="inline-flex items-center gap-1 text-xs font-semibold underline"
          >
            <RotateCcw className="size-3.5" aria-hidden /> Duyệt lại
          </button>
        )}
      </div>
    );
  }

  function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(undefined);
    startTransition(async () => {
      const saved = await createReviewQuestion(formData);
      if (saved.success) onStatus("accepted");
      else setMessage(saved.error);
    });
  }

  const lowConfidence = question.confidence < 70;
  return (
    <article className="overflow-hidden rounded-3xl border border-navy-100 bg-pastel-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-navy-600 px-3 py-1 font-semibold text-white">
            Câu {question.number}
          </span>
          <span className="rounded-full bg-pastel-100 px-3 py-1 font-semibold text-navy-500">
            {typeLabel(type)}
          </span>
          <span className={lowConfidence ? "font-semibold text-amber-700" : "text-navy-300"}>
            Tin cậy {question.confidence}%
          </span>
        </div>
        <button
          type="button"
          onClick={() => onStatus("skipped")}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <SkipForward className="size-3.5" aria-hidden /> Bỏ qua
        </button>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(260px,.8fr)_minmax(0,1.2fr)]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-300">
            Bản dựng LaTeX
          </p>
          <div className="rounded-2xl border border-navy-100 bg-white p-4 text-sm leading-7 text-navy-600">
            <MathText>{content || "Chưa có nội dung"}</MathText>
            {question.questionFigures.map((figure) => (
              <figure key={figure.objectKey} className="my-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- protected dynamic OCR figure */}
                <img src={figure.url} alt={figure.alt} className="mx-auto max-h-80 rounded-xl object-contain" />
              </figure>
            ))}
            {type !== "SHORT_ANSWER" && (
              <div className="mt-3 grid gap-2">
                {options.filter(Boolean).map((option, index) => (
                  <div key={index} className="rounded-xl bg-pastel-50 px-3 py-2">
                    <MathText>{option}</MathText>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-navy-50 pt-3 text-green-800">
              <strong>Đáp án: </strong>
              {correctAnswer ? (
                <MathText mathOnly={type === "SHORT_ANSWER"}>{correctAnswer}</MathText>
              ) : (
                <span className="text-amber-700">chưa nhận diện</span>
              )}
            </div>
            {(textSolution || question.solutionFigures.length > 0) && (
              <div className="mt-3 border-t border-navy-50 pt-3">
                <strong>Lời giải:</strong>
                {textSolution && <MathText className="mt-1 block">{textSolution}</MathText>}
                {question.solutionFigures.map((figure) => (
                  <figure key={figure.objectKey} className="my-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- protected dynamic OCR figure */}
                    <img src={figure.url} alt={figure.alt} className="mx-auto max-h-80 rounded-xl object-contain" />
                  </figure>
                ))}
              </div>
            )}
          </div>
          <details className="mt-3 rounded-2xl border border-navy-100 bg-white p-3">
            <summary className="cursor-pointer text-xs font-semibold text-navy-500">
              Xem ảnh nguyên bản để đối chiếu
            </summary>
            <div className="mt-3 space-y-3">
              {question.snapshotUrls.map((url, index) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- protected dynamic OCR snapshot */}
                  <img
                    src={url}
                    alt={`Ảnh gốc câu ${question.number}, phần ${index + 1}`}
                    className="w-full rounded-xl border border-navy-100 bg-white object-contain"
                  />
                </a>
              ))}
              {question.snapshotUrls.length === 0 && (
                <p className="p-4 text-center text-xs text-navy-300">Không có ảnh nguồn.</p>
              )}
            </div>
          </details>
          {question.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-800">
              {question.warnings.map((warning) => (
                <li key={warning} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {warningLabel(warning)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={accept} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-navy-400">
            Chương
            <select
              className={input}
              name="chapterId"
              defaultValue={defaults.chapterId}
              required
            >
              <option value="">Chọn chương</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.order}. {chapter.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-navy-400">
            Loại câu
            <select
              className={input}
              name="type"
              value={type}
              onChange={(event) =>
                setType(event.target.value as ImportedReviewQuestionType)
              }
            >
              <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
              <option value="TRUE_FALSE">Đúng / Sai</option>
              <option value="SHORT_ANSWER">Trả lời ngắn</option>
            </select>
          </label>
          <label className="text-xs text-navy-400">
            Khối
            <input
              className={input}
              name="grade"
              defaultValue={defaults.grade}
              placeholder="Ví dụ: 12"
            />
          </label>
          <label className="text-xs text-navy-400">
            Chủ đề
            <input
              className={input}
              name="topic"
              defaultValue={defaults.topic}
              placeholder="Ví dụ: Hàm số"
            />
          </label>
          <label className="text-xs text-navy-400">
            Độ khó
            <select
              className={input}
              name="difficulty"
              defaultValue={defaults.difficulty}
            >
              <option value="EASY">Dễ</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="HARD">Khó</option>
            </select>
          </label>
          <label className="text-xs text-navy-400">
            Đáp án đúng
            <input
              className={`${input} ${question.correctAnswer ? "" : "border-amber-300 bg-amber-50"}`}
              name="correctAnswer"
              value={correctAnswer}
              onChange={(event) => setCorrectAnswer(event.target.value)}
              required
              maxLength={200}
              placeholder={
                type === "MULTIPLE_CHOICE"
                  ? "A, B, C hoặc D"
                  : type === "TRUE_FALSE"
                    ? "D,S,D,S"
                    : "Đáp án ngắn"
              }
            />
          </label>
          <label className="text-xs text-navy-400 sm:col-span-2">
            Nội dung
            <textarea
              className={input}
              name="content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              minLength={2}
              maxLength={5_000}
              rows={5}
            />
          </label>
          {type !== "SHORT_ANSWER" && (
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="text-xs text-navy-400">
                {type === "TRUE_FALSE" ? "Các mệnh đề" : "Các lựa chọn"}
              </legend>
              {options.map((option, index) => (
                <label key={index} className="grid grid-cols-[2rem_1fr_auto] items-start gap-2 text-xs text-navy-400">
                  <span className="mt-3 text-center font-semibold">
                    {type === "TRUE_FALSE" ? String.fromCharCode(97 + index) : String.fromCharCode(65 + index)}
                  </span>
                  <textarea
                    className="w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600 outline-none focus:border-navy-400"
                    name="optionItems"
                    value={option}
                    onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                    required
                    maxLength={1_000}
                    rows={2}
                  />
                  {options.length > 2 && (
                    <button type="button" onClick={() => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="mt-3 text-red-600" aria-label={`Xóa mục ${index + 1}`}>×</button>
                  )}
                </label>
              ))}
              {options.length < 5 && (
                <button type="button" onClick={() => setOptions((current) => [...current, ""])} className="text-xs font-semibold text-navy-500 underline">
                  + Thêm {type === "TRUE_FALSE" ? "mệnh đề" : "lựa chọn"}
                </button>
              )}
            </fieldset>
          )}
          {type === "SHORT_ANSWER" && <input type="hidden" name="options" value="" />}
          <label className="text-xs text-navy-400 sm:col-span-2">
            Lời giải chữ
            <textarea
              className={input}
              name="textSolution"
              value={textSolution}
              onChange={(event) => setTextSolution(event.target.value)}
              rows={3}
              maxLength={10_000}
            />
          </label>
          <ClassMultiSelect
            classes={classes}
            defaultSelected={defaults.classIds}
            className="sm:col-span-2"
          />
          {question.questionFigures.map((figure) => (
            <input key={figure.objectKey} type="hidden" name="questionFigureKeys" value={figure.objectKey} />
          ))}
          {question.solutionFigures.map((figure) => (
            <input key={figure.objectKey} type="hidden" name="solutionFigureKeys" value={figure.objectKey} />
          ))}
          <label className="text-xs text-navy-500 sm:col-span-2">
            <input name="showSolution" type="checkbox" defaultChecked /> Cho xem lời giải
            sau khi trả lời
          </label>
          {message && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 sm:col-span-2">
              {message}
            </p>
          )}
          <button
            disabled={pending || !chapters.length || !classes.length}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-green-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden />
            )}
            {pending ? "Đang nhận…" : "Nhận câu này vào ngân hàng"}
          </button>
        </form>
      </div>
    </article>
  );
}
