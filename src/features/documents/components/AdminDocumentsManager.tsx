"use client";

import { useState, useTransition } from "react";
import { FilePlus2, FolderPlus, Save, Trash2, UploadCloud } from "lucide-react";

import {
  createDocument,
  createFolder,
  deleteFolder,
  prepareDocumentUpload,
  replaceDocumentFile,
  updateDocumentMetadata,
} from "../actions";

type FolderOption = { id: string; name: string; label: string; count: number };
type ClassOption = { id: string; name: string };
type DocumentItem = {
  id: string; title: string; fileName: string; contentType: string; folderId: string | null;
  allowDownload: boolean; showAnswer: boolean; hasAnswer: boolean; updateCount: number;
  classIds: string[]; classNames: string[]; createdAt: string;
  versions: { id: string; version: number; fileName: string; createdAt: string }[];
};
type Result = { success: true } | { success: false; error: string };

const input = "mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600 outline-none focus:border-navy-400";

export function AdminDocumentsManager({ folders, classes, documents, directUpload }: { folders: FolderOption[]; classes: ClassOption[]; documents: DocumentItem[]; directUpload: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  function finish(result: Result) { setMessage(result.success ? "Đã lưu thay đổi." : result.error); }
  function run(action: () => Promise<Result>) { setMessage(undefined); startTransition(async () => finish(await action())); }

  async function putDirect(documentId: string, version: number, file: File, kind: "file" | "answer") {
    const target = await prepareDocumentUpload(documentId, version, file.name, file.type || "application/octet-stream", kind, file.size);
    if (!target.success) throw new Error(target.error);
    const response = await fetch(target.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
    if (!response.ok) throw new Error("Cloudflare R2 từ chối file upload.");
    return target.key;
  }

  function handleCreate(data: FormData) {
    setMessage(undefined);
    startTransition(async () => {
      try {
        if (directUpload) {
          const file = data.get("file");
          const answer = data.get("answer");
          if (!(file instanceof File) || file.size === 0) throw new Error("Hãy chọn file tài liệu.");
          const documentId = crypto.randomUUID();
          data.set("documentId", documentId);
          data.set("fileName", file.name);
          data.set("contentType", file.type || "application/octet-stream");
          data.set("fileKey", await putDirect(documentId, 1, file, "file"));
          if (answer instanceof File && answer.size > 0) data.set("answerKey", await putDirect(documentId, 1, answer, "answer"));
          data.delete("file"); data.delete("answer");
        }
        finish(await createDocument(data));
      } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể upload file."); }
    });
  }

  function handleReplace(item: DocumentItem, data: FormData) {
    setMessage(undefined);
    startTransition(async () => {
      try {
        if (directUpload) {
          const file = data.get("file");
          if (!(file instanceof File) || file.size === 0) throw new Error("Hãy chọn file mới.");
          data.set("fileName", file.name);
          data.set("contentType", file.type || "application/octet-stream");
          data.set("fileKey", await putDirect(item.id, item.updateCount + 2, file, "file"));
          data.delete("file");
        }
        finish(await replaceDocumentFile(item.id, data));
      } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể upload phiên bản mới."); }
    });
  }

  return <div className="space-y-6">
    {message && <p role="status" className="rounded-xl bg-pastel-100 px-4 py-3 text-sm text-navy-500">{message}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <details className="rounded-3xl border border-navy-100 bg-white p-5"><summary className="flex cursor-pointer items-center gap-2 font-semibold text-navy-600"><FolderPlus className="size-5" />Tạo thư mục</summary><form action={(data) => run(() => createFolder(data))} className="mt-4 space-y-3"><label className="text-sm text-navy-500">Tên thư mục<input className={input} name="name" required maxLength={100} /></label><label className="text-sm text-navy-500">Nằm trong<select className={input} name="parentId"><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label><button disabled={pending} className="rounded-full bg-navy-600 px-4 py-2 text-sm font-semibold text-white">Tạo thư mục</button></form></details>
      <details className="rounded-3xl border border-navy-100 bg-white p-5" open={documents.length === 0}><summary className="flex cursor-pointer items-center gap-2 font-semibold text-navy-600"><FilePlus2 className="size-5" />Thêm tài liệu</summary><form action={handleCreate} className="mt-4 space-y-3"><label className="text-sm text-navy-500">Tên tài liệu<input className={input} name="title" required maxLength={180} /></label><label className="text-sm text-navy-500">File (tối đa 30 MB)<input className={input} name="file" type="file" required /></label><label className="text-sm text-navy-500">File đáp án (không bắt buộc)<input className={input} name="answer" type="file" /></label><label className="text-sm text-navy-500">Thư mục<select className={input} name="folderId"><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label><ClassChecks classes={classes} /><div className="flex flex-wrap gap-4 text-xs text-navy-500"><label><input name="allowDownload" type="checkbox" /> Cho tải xuống</label><label><input name="showAnswer" type="checkbox" /> Công bố đáp án</label></div><button disabled={pending || classes.length === 0} className="inline-flex items-center gap-2 rounded-full bg-navy-600 px-4 py-2 text-sm font-semibold text-white"><UploadCloud className="size-4" />{pending ? "Đang tải…" : "Tải lên"}</button></form></details>
    </div>
    <div className="rounded-3xl border border-navy-100 bg-white p-5"><h2 className="font-semibold text-navy-600">Cây thư mục</h2><div className="mt-3 space-y-1">{folders.length ? folders.map((folder) => <div key={folder.id} className="flex items-center justify-between rounded-xl bg-pastel-50 px-3 py-2 text-sm text-navy-500"><span>📁 {folder.label} <small className="text-navy-300">({folder.count})</small></span><button disabled={pending || folder.count > 0} onClick={() => confirm(`Xóa thư mục “${folder.name}”?`) && run(() => deleteFolder(folder.id))} title={folder.count ? "Chỉ xóa được thư mục rỗng" : "Xóa thư mục"} className="text-red-500 disabled:opacity-30"><Trash2 className="size-4" /></button></div>) : <p className="text-sm text-navy-300">Chưa có thư mục.</p>}</div></div>
    <div className="grid gap-4 xl:grid-cols-2">{documents.map((item) => <article key={item.id} className="rounded-3xl border border-navy-100 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-navy-600">{item.title}</h2><p className="mt-1 text-xs text-navy-300">{item.fileName} · v{item.updateCount + 1} · {new Date(item.createdAt).toLocaleDateString("vi-VN")}</p><p className="mt-1 text-xs text-navy-400">Lớp: {item.classNames.join(", ")}</p></div><a href={`/api/documents/${item.id}/file`} target="_blank" className="text-xs font-semibold text-navy-500 underline">Xem</a></div><div className="mt-3 flex gap-2 text-xs"><span className="rounded-full bg-pastel-50 px-2 py-1">{item.allowDownload ? "Cho tải" : "Chỉ xem"}</span><span className="rounded-full bg-pastel-50 px-2 py-1">{item.hasAnswer ? item.showAnswer ? "Đã mở đáp án" : "Ẩn đáp án" : "Không có đáp án"}</span></div>
      <details className="mt-4 border-t border-navy-50 pt-3"><summary className="cursor-pointer text-sm font-semibold text-navy-500">Đổi tên, di chuyển và gán lớp</summary><form action={(data) => run(() => updateDocumentMetadata(item.id, data))} className="mt-3 space-y-3"><label className="text-xs text-navy-400">Tên<input className={input} name="title" defaultValue={item.title} /></label><label className="text-xs text-navy-400">Thư mục<select className={input} name="folderId" defaultValue={item.folderId ?? ""}><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label><ClassChecks classes={classes} selected={item.classIds} /><div className="flex gap-4 text-xs"><label><input name="allowDownload" type="checkbox" defaultChecked={item.allowDownload} /> Cho tải</label><label><input name="showAnswer" type="checkbox" defaultChecked={item.showAnswer} disabled={!item.hasAnswer} /> Công bố đáp án</label></div><button disabled={pending} className="inline-flex items-center gap-1 rounded-full bg-navy-600 px-4 py-2 text-xs font-semibold text-white"><Save className="size-3.5" />Lưu</button></form></details>
      <details className="mt-3 border-t border-navy-50 pt-3"><summary className="cursor-pointer text-sm font-semibold text-navy-500">Cập nhật phiên bản</summary><form action={(data) => handleReplace(item, data)} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-xs text-navy-400">File mới<input className={input} name="file" type="file" required /></label><button disabled={pending} className="rounded-full bg-navy-600 px-4 py-2.5 text-xs font-semibold text-white">Tải v{item.updateCount + 2}</button></form><div className="mt-2 text-xs text-navy-300">Lịch sử: {item.versions.map((version) => `v${version.version} (${new Date(version.createdAt).toLocaleDateString("vi-VN")})`).join(" · ")}</div></details>
    </article>)}</div>
    {documents.length === 0 && <p className="rounded-3xl border border-dashed border-navy-100 p-10 text-center text-sm text-navy-300">Chưa có tài liệu.</p>}
  </div>;
}

function ClassChecks({ classes, selected = [] }: { classes: ClassOption[]; selected?: string[] }) { return <fieldset><legend className="text-sm text-navy-500">Giao cho lớp</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{classes.map((item) => <label key={item.id} className="rounded-xl bg-pastel-50 px-3 py-2 text-xs text-navy-500"><input name="classIds" value={item.id} type="checkbox" defaultChecked={selected.includes(item.id)} /> {item.name}</label>)}</div>{classes.length === 0 && <p className="mt-1 text-xs text-amber-700">Chưa có lớp đang hoạt động.</p>}</fieldset>; }
