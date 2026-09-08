"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanText } from "lucide-react";

import { analyzeExamPdf, createExam, discardExamUpload } from "../admin-actions";
import type { ExamQuestionType } from "../types";
import { uploadExamPdf } from "./exam-upload";
import { InlineExamFolderCreator } from "./InlineExamFolderCreator";

type ClassOption = { id: string; name: string; code: string; level: string };
type FolderOption = { id: string; label: string };
type Section = { label: string; count: number; type: ExamQuestionType };

const STANDARD_SECTIONS: Section[] = [
  { label: "Phần I — Trắc nghiệm", count: 12, type: "MULTIPLE_CHOICE" },
  { label: "Phần II — Đúng / Sai", count: 4, type: "TRUE_FALSE" },
  { label: "Phần III — Trả lời ngắn", count: 6, type: "SHORT_ANSWER" },
];
const inputClass = "mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600 outline-none focus:border-navy-400";

function emptyAnswer(type: ExamQuestionType) {
  return type === "TRUE_FALSE" ? ",,," : "";
}

function answerFitsType(answer: string | undefined, type: ExamQuestionType) {
  if (!answer) return type !== "TRUE_FALSE";
  if (type === "MULTIPLE_CHOICE") return ["A", "B", "C", "D"].includes(answer);
  if (type === "TRUE_FALSE") return answer.split(",").length === 4;
  return true;
}

function flattenTypes(sections: Section[]) {
  return sections.flatMap((section) => Array(section.count).fill(section.type) as ExamQuestionType[]);
}

type UploadedFiles = {
  examId: string;
  examFile: File;
  answerFile?: File;
  examKey: string;
  answerKey?: string;
};

export function ExamCreateForm({ classes, folders, directUpload }: { classes: ClassOption[]; folders: FolderOption[]; directUpload: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>();
  const [ocrMessage, setOcrMessage] = useState<string>();
  const [examPdf, setExamPdf] = useState<File>();
  const [answerPdf, setAnswerPdf] = useState<File>();
  const [mode, setMode] = useState("MOCK");
  const [isForever, setIsForever] = useState(true);
  const [sheetType, setSheetType] = useState<"STANDARD" | "CUSTOM">("STANDARD");
  const [sections, setSections] = useState<Section[]>(STANDARD_SECTIONS);
  const [answers, setAnswers] = useState<string[]>(flattenTypes(STANDARD_SECTIONS).map(emptyAnswer));
  const uploadedFiles = useRef<UploadedFiles | null>(null);
  const questionTypes = useMemo(() => flattenTypes(sections), [sections]);
  const total = questionTypes.length;

  function syncSections(next: Section[]) {
    const types = flattenTypes(next);
    setSections(next);
    setAnswers((current) => types.map((type, index) =>
      answerFitsType(current[index], type) ? (current[index] ?? emptyAnswer(type)) : emptyAnswer(type),
    ));
  }

  function chooseSheetType(type: "STANDARD" | "CUSTOM") {
    setSheetType(type);
    syncSections(type === "STANDARD" ? STANDARD_SECTIONS : [{ label: "Phần 1", count: 10, type: "MULTIPLE_CHOICE" }]);
  }

  async function ensureUploaded() {
    if (!examPdf) throw new Error("Hãy chọn file đề PDF trước.");
    const cached = uploadedFiles.current;
    if (cached && cached.examFile === examPdf && cached.answerFile === answerPdf) return cached;
    if (cached) {
      await Promise.all([
        discardExamUpload(cached.examId, cached.examKey),
        cached.answerKey ? discardExamUpload(cached.examId, cached.answerKey) : Promise.resolve(),
      ]);
    }
    const examId = crypto.randomUUID();
    const examKey = await uploadExamPdf({ examId, kind: "exam", file: examPdf });
    try {
      const answerKey = answerPdf
        ? await uploadExamPdf({ examId, kind: "answer", file: answerPdf })
        : undefined;
      const uploaded = { examId, examFile: examPdf, answerFile: answerPdf, examKey, answerKey };
      uploadedFiles.current = uploaded;
      return uploaded;
    } catch (error) {
      await discardExamUpload(examId, examKey);
      throw error;
    }
  }

  async function handleOcr() {
    if (!examPdf) return setError("Hãy chọn file đề PDF trước khi quét OCR.");
    setError(undefined);
    setOcrMessage(undefined);
    setIsAnalyzing(true);
    const data = new FormData();
    try {
      if (directUpload) {
        const uploaded = await ensureUploaded();
        data.set("examId", uploaded.examId);
        data.set("examPdfKey", uploaded.examKey);
        if (uploaded.answerKey) data.set("answerPdfKey", uploaded.answerKey);
      } else {
        data.set("examPdf", examPdf);
        if (answerPdf) data.set("answerPdf", answerPdf);
      }
    } catch (error) {
      setIsAnalyzing(false);
      return setError(error instanceof Error ? error.message : "Không thể upload PDF.");
    }
    const result = await analyzeExamPdf(data);
    setIsAnalyzing(false);
    if (!result.success) return setError(result.error);
    setSheetType("CUSTOM");
    syncSections(result.sections);
    if (result.answerKey) setAnswers(result.answerKey);
    const answerMessage = result.answerKey
      ? ` Đã nhận đủ ${result.answerKey.length} đáp án và điền nháp.`
      : answerPdf
        ? ` Mới nhận được ${result.answerDetectedCount}/22 đáp án nên chưa tự điền.`
        : " Chọn thêm file lời giải để nhận diện đáp án.";
    const sourceMessage = result.analysisSource === "GEMINI"
      ? "Gemini đã đọc trực tiếp PDF"
      : `Gemini chưa cho kết quả đầy đủ, đã fallback sang OCR local${result.ocrPageCount ? ` (${result.ocrPageCount} trang ảnh)` : ""}`;
    setOcrMessage(`${sourceMessage}. Đã đọc ${result.pageCount || "không xác định số"} trang.${answerMessage} Hãy kiểm tra lại trước khi tạo đề.`);
  }

  function handleSubmit(formData: FormData) {
    setError(undefined);
    formData.set("sections", JSON.stringify(sections));
    formData.set("answerKey", JSON.stringify(answers));
    startTransition(async () => {
      if (directUpload) {
        try {
          const uploaded = await ensureUploaded();
          formData.set("examId", uploaded.examId);
          formData.set("examPdfKey", uploaded.examKey);
          if (uploaded.answerKey) formData.set("answerPdfKey", uploaded.answerKey);
          formData.delete("examPdf");
          formData.delete("answerPdf");
        } catch (error) {
          return setError(error instanceof Error ? error.message : "Không thể upload PDF.");
        }
      }
      const result = await createExam(formData);
      if (!result.success) {
        const uploaded = uploadedFiles.current;
        if (uploaded) {
          await Promise.all([
            discardExamUpload(uploaded.examId, uploaded.examKey),
            uploaded.answerKey ? discardExamUpload(uploaded.examId, uploaded.answerKey) : Promise.resolve(),
          ]);
          uploadedFiles.current = null;
        }
        return setError(result.error);
      }
      router.push("/admin/de-thi");
      router.refresh();
    });
  }

  function setAnswer(index: number, value: string) {
    setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? value : answer));
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {!directUpload && <p className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">Chưa cấu hình Google Cloud Storage. Không nên tạo đề trên môi trường production cho tới khi storage được cấu hình đầy đủ.</p>}
      <fieldset disabled={pending} className="space-y-6 disabled:opacity-70">
        <section className="grid gap-4 rounded-3xl border border-navy-100 bg-white p-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-navy-500 sm:col-span-2">Tên đề<input name="title" required minLength={3} maxLength={150} className={inputClass} placeholder="Ví dụ: Đề thi tốt nghiệp THPT 2026 — mã 0102" /></label>
          <label className="text-sm font-medium text-navy-500 sm:col-span-2">Thư mục<select name="folderId" className={inputClass}><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label>
          <InlineExamFolderCreator folders={folders} />
          <label className="text-sm font-medium text-navy-500">File đề PDF (bắt buộc, tối đa 20 MB)<input name="examPdf" required type="file" accept="application/pdf,.pdf" className={inputClass} onChange={(event) => setExamPdf(event.target.files?.[0])} /></label>
          <label className="text-sm font-medium text-navy-500">File đáp án / lời giải PDF (không bắt buộc)<input name="answerPdf" type="file" accept="application/pdf,.pdf" className={inputClass} onChange={(event) => setAnswerPdf(event.target.files?.[0])} /></label>
          <div className="sm:col-span-2"><button type="button" disabled={isAnalyzing || !examPdf} onClick={handleOcr} className="inline-flex items-center gap-2 rounded-full bg-pastel-100 px-4 py-2 text-sm font-semibold text-navy-500 disabled:opacity-50"><ScanText className="size-4" />{isAnalyzing ? "Gemini đang đọc đề và đáp án…" : "Quét bằng Gemini"}</button>{ocrMessage && <p className="mt-2 text-sm text-green-700">{ocrMessage}</p>}</div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-navy-100 bg-white p-5 sm:grid-cols-2">
          <h2 className="font-semibold text-navy-600 sm:col-span-2">Cài đặt giao đề</h2>
          <label className="text-sm font-medium text-navy-500">Chế độ<select name="mode" value={mode} onChange={(event) => setMode(event.target.value)} className={inputClass}><option value="MOCK">Thi thử có đồng hồ</option><option value="PRACTICE">Luyện tập không giới hạn giờ</option></select></label>
          <label className="text-sm font-medium text-navy-500">Thời lượng (phút)<input name="durationMinutes" type="number" min={1} required={mode === "MOCK"} disabled={mode !== "MOCK"} defaultValue={90} className={inputClass} /></label>
          <label className="text-sm font-medium text-navy-500">Số lượt làm tối đa<input name="maxAttempts" type="number" min={1} placeholder="Để trống = không giới hạn" className={inputClass} /></label>
          <div className="rounded-xl bg-pastel-50 p-3 text-sm"><label className="flex items-center gap-2 font-medium text-navy-500"><input name="isForever" type="checkbox" checked={isForever} onChange={(event) => setIsForever(event.target.checked)} />Mở vĩnh viễn</label></div>
          {!isForever && <><label className="text-sm font-medium text-navy-500">Mở từ (giờ Việt Nam)<input name="availableFrom" required type="datetime-local" className={inputClass} /></label><label className="text-sm font-medium text-navy-500">Đóng lúc (giờ Việt Nam)<input name="availableTo" required type="datetime-local" className={inputClass} /></label></>}
          <div className="grid gap-3 text-sm text-navy-500 sm:col-span-2 sm:grid-cols-3"><label className="flex gap-2"><input name="allowDownload" type="checkbox" /> Cho phép tải PDF</label><label className="flex gap-2"><input name="showAnswer" type="checkbox" /> Hiện lời giải sau khi nộp</label><label className="flex gap-2"><input name="hideWrongAnswers" type="checkbox" /> Ẩn đáp án đúng nếu làm sai</label></div>
          <label className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800 sm:col-span-2"><input name="publishNow" type="checkbox" defaultChecked /> Xuất bản ngay sau khi tạo (bỏ chọn để lưu nháp)</label>
          <div className="sm:col-span-2"><p className="text-sm font-medium text-navy-500">Giao cho lớp</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{classes.map((item) => <label key={item.id} className="flex gap-2 rounded-xl border border-navy-100 p-3 text-sm text-navy-500"><input name="classIds" value={item.id} type="checkbox" />{item.code} · {item.name} · {item.level === "ADVANCED" ? "Nâng cao" : "Cơ bản"}</label>)}</div>{classes.length === 0 && <p className="mt-2 text-sm text-amber-700">Chưa có lớp đang hoạt động. Hãy tạo lớp trước.</p>}</div>
        </section>

        <section className="space-y-4 rounded-3xl border border-navy-100 bg-white p-5">
          <div><h2 className="font-semibold text-navy-600">Phiếu đáp án & key chấm tự động</h2><p className="mt-1 text-sm text-navy-300">Mẫu chuẩn hiện dùng đúng cấu trúc data: 12 trắc nghiệm + 4 đúng/sai + 6 trả lời ngắn.</p></div>
          <div className="flex gap-2">{(["STANDARD", "CUSTOM"] as const).map((type) => <button key={type} type="button" onClick={() => chooseSheetType(type)} className={`rounded-full px-4 py-2 text-sm font-semibold ${sheetType === type ? "bg-navy-600 text-white" : "bg-pastel-50 text-navy-400"}`}>{type === "STANDARD" ? "Mẫu THPT 12–4–6" : "Tùy chỉnh / kết quả OCR"}</button>)}</div>
          <div className="space-y-2">{sections.map((section, index) => <div key={`${section.type}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_12rem_7rem]"><input value={section.label} disabled={sheetType === "STANDARD"} onChange={(event) => syncSections(sections.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} className={inputClass} aria-label={`Tên phần ${index + 1}`} /><select value={section.type} disabled={sheetType === "STANDARD"} onChange={(event) => syncSections(sections.map((item, i) => i === index ? { ...item, type: event.target.value as ExamQuestionType } : item))} className={inputClass}><option value="MULTIPLE_CHOICE">Trắc nghiệm</option><option value="TRUE_FALSE">Đúng / Sai</option><option value="SHORT_ANSWER">Trả lời ngắn</option></select><input value={section.count || ""} type="number" min={1} max={200} disabled={sheetType === "STANDARD"} onChange={(event) => syncSections(sections.map((item, i) => i === index ? { ...item, count: Number(event.target.value) } : item))} className={inputClass} aria-label={`Số câu phần ${index + 1}`} /></div>)}</div>
          <p className="text-sm font-semibold text-navy-500">Tổng: {total} câu</p>
          <div className="grid gap-3 sm:grid-cols-4"><label className="text-xs text-navy-400">Điểm/câu trắc nghiệm<input className={inputClass} name="multipleChoicePoints" type="number" min="0.01" step="0.01" defaultValue="0.25" /></label><label className="text-xs text-navy-400">Điểm/câu đúng-sai<input className={inputClass} name="trueFalsePoints" type="number" min="0.01" step="0.01" defaultValue="1" /></label><label className="text-xs text-navy-400">Điểm/câu trả lời ngắn<input className={inputClass} name="shortAnswerPoints" type="number" min="0.01" step="0.01" defaultValue="0.5" /></label><label className="text-xs text-navy-400">Chính sách đúng-sai<select className={inputClass} name="trueFalsePolicy"><option value="STANDARD">0 / 0,1 / 0,25 / 0,5 / 1</option><option value="ALL_OR_NOTHING">Đúng hết mới có điểm</option></select></label></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {answers.map((answer, index) => {
              const type = questionTypes[index];
              return <div key={index} className="rounded-2xl bg-pastel-50 p-3 text-xs font-semibold text-navy-400"><p>Câu {index + 1}</p>{type === "MULTIPLE_CHOICE" ? <select required value={answer} onChange={(event) => setAnswer(index, event.target.value)} className={inputClass}><option value="">Chọn đáp án</option><option>A</option><option>B</option><option>C</option><option>D</option></select> : type === "TRUE_FALSE" ? <div className="mt-2 grid grid-cols-4 gap-1">{answer.split(",").map((value, statementIndex) => <label key={statementIndex} className="text-center">{String.fromCharCode(97 + statementIndex)}<select required value={value} onChange={(event) => { const values = answer.split(","); values[statementIndex] = event.target.value; setAnswer(index, values.join(",")); }} className="mt-1 w-full rounded-lg border border-navy-100 bg-white p-1.5"><option value="">—</option><option value="D">Đ</option><option value="S">S</option></select></label>)}</div> : <input required value={answer} maxLength={50} onChange={(event) => setAnswer(index, event.target.value)} className={inputClass} placeholder="Đáp án ngắn" />}</div>;
            })}
          </div>
        </section>
      </fieldset>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <button disabled={pending || isAnalyzing || classes.length === 0 || total === 0 || total > 200} className="rounded-full bg-navy-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Đang tải file và tạo đề…" : "Tạo đề thi"}</button>
    </form>
  );
}
