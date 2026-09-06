import Link from "next/link";
import { Archive, BookOpen, CalendarDays, FileQuestion, FolderOpen, Users } from "lucide-react";

import { getClassesForCurrentStudent } from "@/features/classes/queries";
import { formatClassSchedule } from "@/features/classes/schedule";

export const dynamic = "force-dynamic";

export default async function ClassListPage() {
  const classes = await getClassesForCurrentStudent();
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold text-navy-600">Lớp học của tôi</h1>
      <p className="-mt-4 text-sm text-navy-400">Nội dung và bài tập được giáo viên giao riêng cho từng lớp.</p>
      {classes.length === 0 ? <div className="rounded-3xl border border-dashed border-navy-200 bg-white p-12 text-center text-sm text-navy-400">Bạn chưa được xếp vào lớp nào.</div> : <div className="grid gap-4 md:grid-cols-2">{classes.map((item) => <Link key={item.id} href={`/lop-hoc/${item.id}`} className="rounded-3xl border border-navy-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-pastel-100 px-3 py-1 text-xs font-semibold text-navy-500">{item.level === "ADVANCED" ? "Nâng cao" : "Cơ bản"}</span><h2 className="mt-3 text-lg font-semibold text-navy-600">{item.name}</h2><p className="mt-1 text-xs font-semibold tracking-wide text-navy-300">Mã lớp: {item.code}</p></div>{item.status === "ARCHIVED" && <Archive className="size-5 text-slate-400" />}</div><p className="mt-2 inline-flex items-center gap-1.5 text-sm text-navy-400"><CalendarDays className="size-4" />{formatClassSchedule(item.scheduleSlots, item.schedule)}</p>{item.description && <p className="mt-2 line-clamp-2 text-sm text-navy-300">{item.description}</p>}<div className="mt-4 flex flex-wrap gap-3 text-xs text-navy-400"><span className="inline-flex items-center gap-1"><Users className="size-3.5" />{item._count.enrollments} HS</span><span className="inline-flex items-center gap-1"><FolderOpen className="size-3.5" />{item._count.documentLinks} tài liệu</span><span className="inline-flex items-center gap-1"><BookOpen className="size-3.5" />{item._count.questionLinks} câu ôn</span><span className="inline-flex items-center gap-1"><FileQuestion className="size-3.5" />{item._count.examLinks} đề</span></div></Link>)}</div>}
    </section>
  );
}
