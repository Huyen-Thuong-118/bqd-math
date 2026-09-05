import Link from "next/link";

import { PdfViewer } from "@/features/exams/components/PdfViewer";
import { getDocumentForCurrentStudent } from "@/features/documents/queries";

export const dynamic = "force-dynamic";

export default async function DocumentViewerPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params; const document = await getDocumentForCurrentStudent(documentId);
  const isPdf = document.contentType === "application/pdf" || document.fileName.toLowerCase().endsWith(".pdf");
  return <section className="space-y-5"><Link href="/tai-lieu" className="text-sm font-semibold text-navy-400">← Kho tài liệu</Link><div><h1 className="text-2xl font-semibold text-navy-600">{document.title}</h1><p className="mt-1 text-sm text-navy-300">{document.fileName} · Phiên bản {document.updateCount + 1}</p></div>{isPdf ? <div className="grid gap-5 xl:grid-cols-2"><PdfViewer title="Tài liệu" fileUrl={`/api/documents/${document.id}/file`} allowDownload={document.allowDownload} watermark={document.studentName} unavailableMessage="Không thể mở tài liệu." />{document.answerUrl && document.showAnswer && <PdfViewer title="Đáp án" muted fileUrl={`/api/documents/${document.id}/answer`} allowDownload={document.allowDownload} watermark={document.studentName} unavailableMessage="Đáp án chưa được công bố." />}</div> : <div className="rounded-3xl border border-navy-100 bg-white p-8 text-center"><p className="text-sm text-navy-400">Định dạng này được mở bằng ứng dụng phù hợp trên thiết bị.</p><a href={`/api/documents/${document.id}/file${document.allowDownload ? "?download=1" : ""}`} target="_blank" className="mt-4 inline-block rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white">Mở tài liệu</a></div>}</section>;
}
