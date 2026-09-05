import Link from "next/link";
import { Archive, Bell, BookOpen, CalendarDays, Download, ExternalLink, FileQuestion, FolderOpen } from "lucide-react";

import { getClassForCurrentStudent } from "@/features/classes/queries";
import { formatClassSchedule } from "@/features/classes/schedule";

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const classroom = await getClassForCurrentStudent(classId);
  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-linear-to-br from-navy-600 to-navy-800 p-6 text-white"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{classroom.level === "ADVANCED" ? "Nâng cao" : "Cơ bản"}</span>{classroom.status === "ARCHIVED" && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs"><Archive className="size-3.5" />Đã lưu trữ</span>}</div><h1 className="mt-3 text-2xl font-semibold">{classroom.name}</h1><p className="mt-2 inline-flex items-center gap-2 text-sm text-pastel-200"><CalendarDays className="size-4" />{formatClassSchedule(classroom.scheduleSlots, classroom.schedule)}</p>{classroom.description && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-pastel-100">{classroom.description}</p>}</div>
      <ContentSection title="Thông báo" icon={Bell}>{classroom.announcements.length ? <div className="space-y-3">{classroom.announcements.map((item) => <article key={item.id} className="rounded-2xl bg-pastel-50 p-4"><h3 className="font-semibold text-navy-600">{item.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-navy-400">{item.content}</p><time className="mt-2 block text-xs text-navy-300">{item.createdAt.toLocaleString("vi-VN")}</time></article>)}</div> : <Empty text="Chưa có thông báo." />}</ContentSection>
      <ContentSection title="Tài liệu" icon={FolderOpen}>{classroom.documentLinks.length ? <div className="grid gap-3 sm:grid-cols-2">{classroom.documentLinks.map(({ document }) => <article key={document.id} className="rounded-2xl border border-navy-100 p-4"><h3 className="font-semibold text-navy-600">{document.title}</h3><p className="mt-1 text-xs text-navy-300">{document.fileName} · Cập nhật lần thứ {document.updateCount + 1}</p><div className="mt-3 flex flex-wrap gap-3"><Link className="inline-flex items-center gap-1 text-xs font-semibold text-navy-500 underline" href={`/tai-lieu/${document.id}`}><ExternalLink className="size-3.5" />Xem online</Link>{document.allowDownload && <a className="inline-flex items-center gap-1 text-xs font-semibold text-navy-500 underline" href={`/api/documents/${document.id}/file?download=1`}><Download className="size-3.5" />Tải xuống</a>}{document.answerUrl && document.showAnswer && <Link className="text-xs font-semibold text-navy-500 underline" href={`/tai-lieu/${document.id}`}>Đáp án</Link>}</div></article>)}</div> : <Empty text="Chưa có tài liệu." />}</ContentSection>
      <ContentSection title="Đề thi và bài tập" icon={FileQuestion}>{classroom.examLinks.length ? <div className="space-y-2">{classroom.examLinks.map(({ exam }) => <Link key={exam.id} href="/thi-thu" className="flex items-center justify-between rounded-2xl bg-pastel-50 p-4 text-sm text-navy-500"><span><strong>{exam.title}</strong><span className="ml-2 text-xs text-navy-300">{exam.mode === "MOCK" ? "Thi thử" : "Luyện tập"}</span></span><span className="text-xs font-semibold">{exam.status === "CLOSED" ? "Đã đóng" : "Mở bài →"}</span></Link>)}</div> : <Empty text="Chưa được giao đề." />}</ContentSection>
      <ContentSection title="Ôn tập nhanh" icon={BookOpen}>{classroom.questionLinks.length ? <div className="space-y-2">{classroom.questionLinks.map(({ question }) => <Link key={question.id} href={`/on-tap/${question.chapter.id}`} className="block rounded-2xl bg-pastel-50 p-4 text-sm text-navy-500"><span className="text-xs text-navy-300">{question.chapter.name}</span><p className="mt-1 line-clamp-2 font-medium">{question.content}</p></Link>)}</div> : <Empty text="Chưa được giao câu hỏi ôn tập." />}</ContentSection>
    </section>
  );
}

function ContentSection({ title, icon: Icon, children }: { title: string; icon: typeof Bell; children: React.ReactNode }) { return <section className="rounded-3xl border border-navy-100 bg-white p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-navy-600"><Icon className="size-5" />{title}</h2>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="rounded-2xl border border-dashed border-navy-100 p-6 text-center text-sm text-navy-300">{text}</p>; }
