import Link from "next/link";
import { Download, ExternalLink, FolderOpen } from "lucide-react";

import { getDocumentsForCurrentStudent } from "@/features/documents/queries";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const documents = await getDocumentsForCurrentStudent();
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold text-navy-600">Tài liệu</h1>
      <p className="-mt-4 text-sm text-navy-400">Kho tài liệu được chia sẻ cho các lớp bạn đang học.</p>
      {documents.length ? <div className="grid gap-4 md:grid-cols-2">{documents.map((item) => { const parts = [item.folder?.parent?.parent?.name, item.folder?.parent?.name, item.folder?.name].filter(Boolean); return <article key={item.id} className="rounded-3xl border border-navy-100 bg-white p-5"><p className="flex items-center gap-1.5 text-xs text-navy-300"><FolderOpen className="size-3.5" />{parts.join(" / ") || "Thư mục gốc"}</p><h2 className="mt-2 font-semibold text-navy-600">{item.title}</h2><p className="mt-1 text-xs text-navy-300">{item.fileName} · v{item.updateCount + 1} · {item.classLinks.map((link) => link.class.name).join(", ")}</p><div className="mt-4 flex flex-wrap gap-3"><Link href={`/tai-lieu/${item.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-navy-500 underline"><ExternalLink className="size-4" />Xem online</Link>{item.allowDownload && <a href={`/api/documents/${item.id}/file?download=1`} className="inline-flex items-center gap-1 text-sm font-semibold text-navy-500 underline"><Download className="size-4" />Tải xuống</a>}{item.answerUrl && item.showAnswer && <Link href={`/tai-lieu/${item.id}`} className="text-sm font-semibold text-navy-500 underline">Xem đáp án</Link>}</div></article>; })}</div> : <div className="rounded-3xl border border-dashed border-navy-200 bg-white p-12 text-center text-sm text-navy-400">Chưa có tài liệu nào được giao.</div>}
    </section>
  );
}
