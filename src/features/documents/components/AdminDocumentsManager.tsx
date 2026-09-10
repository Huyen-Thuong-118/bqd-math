"use client";

import { useState, useTransition } from "react";
import { ChevronDown, FilePlus2, FolderPlus, Save, UploadCloud } from "lucide-react";

import { ClassMultiSelect } from "@/components/forms/ClassMultiSelect";
import { ResourceTree } from "@/components/tree/ResourceTree";
import { ResizableTreeLayout } from "@/components/tree/ResizableTreeLayout";
import { ResponsiveTreePanel } from "@/components/tree/ResponsiveTreePanel";
import {
  copyDocument,
  copyDocumentFolder,
  createDocument,
  createFolder,
  deleteFolder,
  moveDocument,
  moveFolder,
  prepareDocumentUpload,
  renameFolder,
  replaceDocumentFile,
  updateDocumentMetadata,
} from "../actions";

type FolderOption = { id: string; name: string; label: string; parentId: string | null; position: number; count: number };
type ClassOption = { id: string; name: string; code: string };
type DocumentItem = {
  id: string; title: string; fileName: string; contentType: string; folderId: string | null; position: number;
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
    if (!response.ok) throw new Error("Google Cloud Storage từ chối file upload.");
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

  const treeResources = documents.map((item) => ({ id: item.id, title: item.title, folderId: item.folderId, position: item.position, meta: item.fileName }));

  function createFolderFromGrid(name: string, parentId: string | null) {
    const data = new FormData();
    data.set("name", name);
    if (parentId) data.set("parentId", parentId);
    run(() => createFolder(data));
  }

  function folderPanel(mode: "tree" | "grid") {
    return <section className="min-w-0 max-w-full rounded-3xl border border-navy-100 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold text-navy-600">{mode === "grid" ? "Kho tài liệu" : "Cây thư mục tài liệu"}</h2><p className="mt-1 text-xs text-navy-300">{mode === "grid" ? "Mở thư mục, kéo thả và sắp xếp như một ổ đĩa." : "Kéo thả tài liệu và thư mục để sắp xếp trực quan."}</p></div>
        {mode === "tree" && <details className="relative">
          <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-pastel-100 px-4 py-2 text-xs font-semibold text-navy-500"><FolderPlus className="size-4" />Tạo thư mục</summary>
          <form action={(data) => run(() => createFolder(data))} className="mt-3 space-y-3 rounded-2xl border border-navy-100 bg-pastel-50 p-4">
            <label className="text-xs text-navy-400">Tên thư mục<input className={input} name="name" required maxLength={100} /></label>
            <label className="text-xs text-navy-400">Nằm trong<select className={input} name="parentId"><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label>
            <button disabled={pending} className="min-h-10 rounded-full bg-navy-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Tạo thư mục</button>
          </form>
        </details>}
      </div>
      <div className="mt-4">
        <ResourceTree
          folders={folders}
          resources={treeResources}
          resourceName="tài liệu"
          mode={mode}
          pending={pending}
          onMoveFolder={(id, parentId, position) => run(() => moveFolder(id, parentId, position))}
          onMoveResource={(id, folderId, position) => run(() => moveDocument(id, folderId, position))}
          onRenameFolder={(id, name) => run(() => renameFolder(id, name))}
          onDeleteFolder={(id) => run(() => deleteFolder(id))}
          onCreateFolder={createFolderFromGrid}
          onCopyFolder={(id, parentId) => run(() => copyDocumentFolder(id, parentId))}
          onCopyResource={(id, folderId) => run(() => copyDocument(id, folderId))}
        />
      </div>
    </section>;
  }

  return <div className="space-y-5">
    {message && <p role="status" className="rounded-xl bg-pastel-100 px-4 py-3 text-sm text-navy-500">{message}</p>}
    <ResizableTreeLayout
      storageKey="admin-documents:tree-width"
      tree={<div className="min-w-0 xl:sticky xl:top-5">
        <ResponsiveTreePanel title="Cây thư mục tài liệu" triggerLabel="Mở cây thư mục tài liệu">
          {folderPanel("tree")}
        </ResponsiveTreePanel>
      </div>}
      grid={<div className="min-w-0 xl:sticky xl:top-5">{folderPanel("grid")}</div>}
      content={<div className="min-w-0 space-y-4">
        <details className="rounded-3xl border border-navy-100 bg-white p-5" open={documents.length === 0}>
          <summary className="flex cursor-pointer items-center gap-2 font-semibold text-navy-600"><FilePlus2 className="size-5" />Thêm tài liệu</summary>
          <form action={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-navy-500 sm:col-span-2">Tên tài liệu<input className={input} name="title" required maxLength={180} /></label>
            <label className="text-sm text-navy-500">File (tối đa 30 MB)<input className={input} name="file" type="file" required /></label>
            <label className="text-sm text-navy-500">File đáp án (không bắt buộc)<input className={input} name="answer" type="file" /></label>
            <label className="text-sm text-navy-500 sm:col-span-2">Thư mục<select className={input} name="folderId"><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label>
            <div className="sm:col-span-2"><ClassChecks classes={classes} /></div>
            <div className="flex flex-wrap gap-4 text-xs text-navy-500 sm:col-span-2"><label><input name="allowDownload" type="checkbox" /> Cho tải xuống</label><label><input name="showAnswer" type="checkbox" /> Công bố đáp án</label></div>
            <button disabled={pending || classes.length === 0} className="inline-flex w-fit items-center gap-2 rounded-full bg-navy-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><UploadCloud className="size-4" />{pending ? "Đang tải…" : "Tải lên"}</button>
          </form>
        </details>
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {documents.map((item) => <details id={`document-${item.id}`} key={item.id} className="group scroll-mt-6 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm transition hover:border-navy-200 hover:shadow-md open:rounded-3xl target:ring-2 target:ring-navy-300">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 marker:hidden">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-pastel-100 px-2 py-0.5 text-[10px] font-semibold text-navy-500">{item.contentType === "application/pdf" || item.fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "Tài liệu"}</span><span className="rounded-full bg-pastel-50 px-2 py-0.5 text-[10px] font-semibold text-navy-400">Phiên bản {item.updateCount + 1}</span></div>
                <h2 className="mt-1.5 line-clamp-2 font-semibold leading-snug text-navy-600">{item.title}</h2>
                <p className="mt-1 line-clamp-2 break-all text-xs text-navy-300" title={item.fileName}>{item.fileName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-pastel-50 px-2.5 py-1 text-[11px] font-semibold text-navy-400">{item.classNames.length} lớp</span><ChevronDown className="mt-1 size-4 text-navy-300 transition-transform group-open:rotate-180" aria-hidden="true" /></div>
            </summary>
            <div className="border-t border-navy-50 p-4">
              <p className="text-sm text-navy-400"><strong className="font-semibold text-navy-500">Lớp:</strong> {item.classNames.join(", ") || "Chưa giao"}</p>
              <p className="mt-2 text-xs text-navy-300">Ngày thêm: {new Date(item.createdAt).toLocaleDateString("vi-VN")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-pastel-50 px-2 py-1">{item.allowDownload ? "Cho tải" : "Chỉ xem"}</span><span className="rounded-full bg-pastel-50 px-2 py-1">{item.hasAnswer ? item.showAnswer ? "Đã mở đáp án" : "Ẩn đáp án" : "Không có đáp án"}</span><a href={`/api/documents/${item.id}/file`} target="_blank" rel="noreferrer" className="ml-auto font-semibold text-navy-500 underline">Xem tài liệu</a></div>
              <details className="mt-4 border-t border-navy-50 pt-3"><summary className="cursor-pointer text-sm font-semibold text-navy-500">Đổi tên, di chuyển và gán lớp</summary><form action={(data) => run(() => updateDocumentMetadata(item.id, data))} className="mt-3 space-y-3"><label className="text-xs text-navy-400">Tên<input className={input} name="title" defaultValue={item.title} /></label><label className="text-xs text-navy-400">Thư mục<select className={input} name="folderId" defaultValue={item.folderId ?? ""}><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label><ClassChecks classes={classes} selected={item.classIds} /><div className="flex flex-wrap gap-4 text-xs"><label><input name="allowDownload" type="checkbox" defaultChecked={item.allowDownload} /> Cho tải</label><label><input name="showAnswer" type="checkbox" defaultChecked={item.showAnswer} disabled={!item.hasAnswer} /> Công bố đáp án</label></div><button disabled={pending} className="inline-flex items-center gap-1 rounded-full bg-navy-600 px-4 py-2 text-xs font-semibold text-white"><Save className="size-3.5" />Lưu</button></form></details>
              <details className="mt-3 border-t border-navy-50 pt-3"><summary className="cursor-pointer text-sm font-semibold text-navy-500">Cập nhật phiên bản</summary><form action={(data) => handleReplace(item, data)} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-xs text-navy-400">File mới<input className={input} name="file" type="file" required /></label><button disabled={pending} className="rounded-full bg-navy-600 px-4 py-2.5 text-xs font-semibold text-white">Tải v{item.updateCount + 2}</button></form><div className="mt-2 break-words text-xs text-navy-300">Lịch sử: {item.versions.map((version) => `v${version.version} (${new Date(version.createdAt).toLocaleDateString("vi-VN")})`).join(" · ")}</div></details>
            </div>
          </details>)}
        </div>
        {documents.length === 0 && <p className="rounded-3xl border border-dashed border-navy-100 p-10 text-center text-sm text-navy-300">Chưa có tài liệu.</p>}
      </div>}
    />
  </div>;
}

function ClassChecks({ classes, selected = [] }: { classes: ClassOption[]; selected?: string[] }) {
  return <ClassMultiSelect classes={classes} defaultSelected={selected} />;
}
