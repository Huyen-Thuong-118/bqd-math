"use client";

import { FolderPlus } from "lucide-react";
import { useState, useTransition } from "react";

import { ResourceTree, type TreeFolder, type TreeResource } from "@/components/tree/ResourceTree";
import { ResponsiveTreePanel } from "@/components/tree/ResponsiveTreePanel";
import {
  createExamFolder,
  deleteExamFolder,
  moveExam,
  moveExamFolder,
  renameExamFolder,
} from "../folder-actions";

type FolderOption = TreeFolder & { label: string };
type Result = { success: true } | { success: false; error: string };
const input = "mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600 outline-none focus:border-navy-400";

export function ExamFolderManager({ folders, exams }: { folders: FolderOption[]; exams: TreeResource[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  function run(action: () => Promise<Result>) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await action();
      setMessage(result.success ? "Đã lưu cây thư mục." : result.error);
    });
  }

  return (
    <ResponsiveTreePanel title="Cây thư mục đề thi" triggerLabel="Mở cây thư mục đề thi">
      <section className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-navy-100 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-navy-600">Cây thư mục đề thi</h2><p className="mt-1 text-xs text-navy-300">Kéo thả đề và thư mục để sắp xếp trực quan.</p></div>
          <details className="relative">
            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-pastel-100 px-4 py-2 text-xs font-semibold text-navy-500"><FolderPlus className="size-4" />Tạo thư mục</summary>
            <form action={(data) => run(() => createExamFolder(data))} className="mt-3 grid gap-3 rounded-2xl border border-navy-100 bg-pastel-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-xs text-navy-400">Tên thư mục<input className={input} name="name" required maxLength={100} /></label>
              <label className="text-xs text-navy-400">Nằm trong<select className={input} name="parentId"><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label>
              <button disabled={pending} className="min-h-11 rounded-full bg-navy-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Tạo</button>
            </form>
          </details>
        </div>
        {message && <p role="status" className="mt-3 rounded-xl bg-pastel-100 px-3 py-2 text-xs text-navy-500">{message}</p>}
        <div className="mt-4">
          <ResourceTree
            folders={folders}
            resources={exams}
            resourceName="đề thi"
            pending={pending}
            onMoveFolder={(id, parentId, position) => run(() => moveExamFolder(id, parentId, position))}
            onMoveResource={(id, folderId, position) => run(() => moveExam(id, folderId, position))}
            onRenameFolder={(id, name) => run(() => renameExamFolder(id, name))}
            onDeleteFolder={(id) => run(() => deleteExamFolder(id))}
          />
        </div>
      </section>
    </ResponsiveTreePanel>
  );
}
