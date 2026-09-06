import type { Metadata } from "next";

import { AdminDocumentsManager } from "@/features/documents/components/AdminDocumentsManager";
import { db } from "@/lib/db";
import { isCloudStorageConfigured } from "@/lib/storage";

export const metadata: Metadata = {
  title: "Tài liệu | BQD Math",
};

export const dynamic = "force-dynamic";

function flattenFolders(folders: { id: string; name: string; parentId: string | null; position: number; _count: { children: number; documents: number } }[]) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  function label(folder: (typeof folders)[number]) {
    const names = [folder.name];
    let parentId = folder.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) { seen.add(parentId); const parent = byId.get(parentId); if (!parent) break; names.unshift(parent.name); parentId = parent.parentId; }
    return names.join(" / ");
  }
  return folders.map((folder) => ({ id: folder.id, name: folder.name, parentId: folder.parentId, position: folder.position, label: label(folder), count: folder._count.children + folder._count.documents })).sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

export default async function AdminDocumentsPage() {
  const [folderRows, classes, rows] = await Promise.all([
    db.folder.findMany({ where: { kind: "DOCUMENT" }, select: { id: true, name: true, parentId: true, position: true, _count: { select: { children: true, documents: true } } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    db.document.findMany({
      select: { id: true, title: true, fileName: true, contentType: true, folderId: true, position: true, allowDownload: true, showAnswer: true, answerUrl: true, updateCount: true, createdAt: true, classLinks: { select: { classId: true, class: { select: { name: true } } } }, versions: { select: { id: true, version: true, fileName: true, createdAt: true }, orderBy: { version: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const documents = rows.map((item) => ({ ...item, hasAnswer: Boolean(item.answerUrl), answerUrl: undefined, createdAt: item.createdAt.toISOString(), classIds: item.classLinks.map((link) => link.classId), classNames: item.classLinks.map((link) => link.class.name), classLinks: undefined, versions: item.versions.map((version) => ({ ...version, createdAt: version.createdAt.toISOString() })) }));
  return (
    <section className="space-y-5">
      <h1 className="text-xl font-semibold text-navy-600">Tài liệu</h1>
      <p className="-mt-4 text-sm text-navy-300">Thư mục nhiều cấp, phiên bản file và quyền xem theo lớp.</p>
      <AdminDocumentsManager folders={flattenFolders(folderRows)} classes={classes} documents={documents} directUpload={isCloudStorageConfigured()} />
    </section>
  );
}
