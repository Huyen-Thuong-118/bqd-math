"use client";

import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createExamFolder } from "../folder-actions";

type FolderOption = { id: string; label: string };
const input = "w-full rounded-xl border border-navy-100 bg-white px-3 py-2 text-xs text-navy-600 outline-none focus:border-navy-400";

export function InlineExamFolderCreator({ folders }: { folders: FolderOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function create() {
    const data = new FormData();
    data.set("name", name);
    data.set("parentId", parentId);
    setMessage(undefined);
    startTransition(async () => {
      const result = await createExamFolder(data);
      if (!result.success) return setMessage(result.error);
      setName("");
      setMessage("Đã tạo. Danh sách thư mục vừa được cập nhật.");
      router.refresh();
    });
  }

  return (
    <div className="sm:col-span-2">
      <button type="button" onClick={() => setOpen((current) => !current)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy-100 px-3 py-2 text-xs font-semibold text-navy-500">
        <FolderPlus className="size-4" /> {open ? "Đóng tạo thư mục" : "Tạo thư mục mới"}
      </button>
      {open && (
        <div className="mt-2 grid gap-2 rounded-2xl bg-pastel-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Tên thư mục" aria-label="Tên thư mục mới" className={input} />
          <select value={parentId} onChange={(event) => setParentId(event.target.value)} aria-label="Thư mục cha" className={input}><option value="">Thư mục gốc</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select>
          <button type="button" disabled={pending || !name.trim()} onClick={create} className="min-h-11 rounded-full bg-navy-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{pending ? "Đang tạo…" : "Tạo"}</button>
          {message && <p role="status" className="text-xs text-navy-400 sm:col-span-3">{message}</p>}
        </div>
      )}
    </div>
  );
}
