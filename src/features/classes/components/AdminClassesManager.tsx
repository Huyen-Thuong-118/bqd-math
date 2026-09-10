"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  Bell,
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UserRoundPlus,
  X,
} from "lucide-react";

import {
  createClass,
  createClassAnnouncement,
  deleteClassAnnouncement,
  setClassEnrollments,
  toggleClassAnnouncement,
  toggleClassArchive,
  updateClass,
  type ClassActionResult,
} from "../actions";
import {
  formatClassSchedule,
  WEEK_DAYS,
  type ClassScheduleSlotInput,
} from "../schedule";

type Student = { id: string; name: string; email: string; studentCode: string | null };
type Announcement = {
  id: string;
  title: string;
  content: string;
  isVisible: boolean;
  createdAt: string;
};
type Classroom = {
  id: string;
  name: string;
  code: string;
  level: "BASIC" | "ADVANCED";
  legacySchedule: string;
  scheduleSlots: ClassScheduleSlotInput[];
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  studentIds: string[];
  announcements: Announcement[];
  counts: { students: number; documents: number; exams: number; questions: number };
  stats: { attempts: number; participants: number; averageScore: number | null };
};

const input = "mt-1 w-full rounded-xl border border-navy-100 bg-white px-3 py-2.5 text-sm text-navy-600 outline-none focus:border-navy-400";
const defaultSlot: ClassScheduleSlotInput = { dayOfWeek: 1, startTime: "18:00", endTime: "20:00" };

function ScheduleEditor({ initialSlots = [defaultSlot] }: { initialSlots?: ClassScheduleSlotInput[] }) {
  const [slots, setSlots] = useState(initialSlots.length ? initialSlots : [defaultSlot]);
  function update(index: number, patch: Partial<ClassScheduleSlotInput>) {
    setSlots((current) => current.map((slot, itemIndex) => itemIndex === index ? { ...slot, ...patch } : slot));
  }
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-sm text-navy-500">Lịch học trong tuần</legend>
      <input type="hidden" name="scheduleSlots" value={JSON.stringify(slots)} />
      {slots.map((slot, index) => (
        <div key={index} className="relative grid grid-cols-2 gap-2 rounded-2xl bg-pastel-50 p-3">
          <label className="col-span-2 pr-10 text-xs text-navy-400">Ngày<select className={input} value={slot.dayOfWeek} onChange={(event) => update(index, { dayOfWeek: Number(event.target.value) })}>{WEEK_DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
          <label className="text-xs text-navy-400">Bắt đầu<input className={input} type="time" required value={slot.startTime} onChange={(event) => update(index, { startTime: event.target.value })} /></label>
          <label className="text-xs text-navy-400">Kết thúc<input className={input} type="time" required value={slot.endTime} onChange={(event) => update(index, { endTime: event.target.value })} /></label>
          <button type="button" aria-label={`Xóa buổi ${index + 1}`} disabled={slots.length === 1} onClick={() => setSlots((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-3 top-3 rounded-xl p-2 text-red-500 disabled:opacity-30"><X className="size-4" /></button>
        </div>
      ))}
      <button type="button" disabled={slots.length >= 14} onClick={() => setSlots((current) => [...current, { ...defaultSlot, dayOfWeek: (current.length + 1) % 7 }])} className="inline-flex items-center gap-1 rounded-full border border-navy-100 px-3 py-2 text-xs font-semibold text-navy-500 disabled:opacity-40"><Plus className="size-3.5" />Thêm buổi học</button>
    </fieldset>
  );
}

function StudentPicker({ classroom, students, pending, run }: { classroom: Classroom; students: Student[]; pending: boolean; run: (action: () => Promise<ClassActionResult>) => void }) {
  const [selected, setSelected] = useState(() => new Set(classroom.studentIds));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "SELECTED" | "UNSELECTED">("ALL");
  const visibleStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return students.filter((student) => {
      const matchesSearch = !query || `${student.studentCode ?? ""} ${student.name} ${student.email}`.toLocaleLowerCase("vi").includes(query);
      const matchesFilter = filter === "ALL" || (filter === "SELECTED" ? selected.has(student.id) : !selected.has(student.id));
      return matchesSearch && matchesFilter;
    });
  }, [filter, search, selected, students]);
  function setVisible(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      visibleStudents.forEach((student) => {
        if (checked) next.add(student.id);
        else next.delete(student.id);
      });
      return next;
    });
  }
  return (
    <details className="mt-3 border-t border-navy-50 pt-3">
      <summary className="cursor-pointer text-sm font-semibold text-navy-500">Học sinh trong lớp ({selected.size}/{students.length})</summary>
      <div className="mt-3 space-y-3">
        <div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-navy-300" /><input className={`${input} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã, tên hoặc email…" /></div>
        <div className="flex flex-wrap gap-2">
          {([["ALL", "Tất cả"], ["SELECTED", "Đã chọn"], ["UNSELECTED", "Chưa chọn"]] as const).map(([filterValue, label]) => <button key={filterValue} type="button" onClick={() => setFilter(filterValue)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === filterValue ? "bg-navy-600 text-white" : "bg-pastel-50 text-navy-400"}`}>{label}</button>)}
          <button type="button" onClick={() => setVisible(true)} className="rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-500">Chọn {visibleStudents.length} kết quả</button>
          <button type="button" onClick={() => setVisible(false)} className="rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-500">Bỏ chọn kết quả</button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {visibleStudents.map((student) => <label key={student.id} className="flex items-center gap-2 rounded-xl bg-pastel-50 px-3 py-2 text-xs text-navy-500"><input type="checkbox" checked={selected.has(student.id)} onChange={(event) => { const checked = event.target.checked; setSelected((current) => { const next = new Set(current); if (checked) next.add(student.id); else next.delete(student.id); return next; }); }} /><span><strong>{student.name}</strong><span className="block text-navy-300">{student.studentCode ?? "Chưa có mã"} · {student.email}</span></span></label>)}
          {!visibleStudents.length && <p className="rounded-xl border border-dashed border-navy-100 p-5 text-center text-xs text-navy-300">Không có học sinh phù hợp.</p>}
        </div>
        <button disabled={pending} type="button" onClick={() => run(() => setClassEnrollments(classroom.id, [...selected]))} className="inline-flex items-center gap-1 rounded-full bg-navy-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><UserRoundPlus className="size-3.5" />Lưu {selected.size} học sinh</button>
      </div>
    </details>
  );
}

function AnnouncementManager({ classroom, pending, run }: { classroom: Classroom; pending: boolean; run: (action: () => Promise<ClassActionResult>) => void }) {
  return (
    <details className="mt-3 border-t border-navy-50 pt-3">
      <summary className="cursor-pointer text-sm font-semibold text-navy-500">Thông báo ({classroom.announcements.length})</summary>
      <div className="mt-3 space-y-3">
        {classroom.status === "ARCHIVED" ? <p className="text-xs text-amber-700">Lớp lưu trữ không nhận nội dung mới.</p> : <form action={(data) => run(() => createClassAnnouncement(classroom.id, data))} className="space-y-2"><input className={input} name="title" required placeholder="Tiêu đề" /><textarea className={input} name="content" required rows={2} placeholder="Nội dung thông báo" /><button disabled={pending} className="inline-flex items-center gap-1 rounded-full bg-navy-600 px-4 py-2 text-xs font-semibold text-white"><Bell className="size-3.5" />Đăng</button></form>}
        {classroom.announcements.map((announcement) => <article key={announcement.id} className={`rounded-2xl border p-3 ${announcement.isVisible ? "border-navy-100 bg-white" : "border-dashed border-slate-200 bg-slate-50 opacity-70"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-navy-600">{announcement.title}</p><p className="mt-1 line-clamp-2 text-xs text-navy-400">{announcement.content}</p><p className="mt-1 text-[11px] text-navy-300">{new Date(announcement.createdAt).toLocaleString("vi-VN")} · {announcement.isVisible ? "Học sinh đang thấy" : "Đã ẩn với học sinh"}</p></div><div className="flex shrink-0 gap-1"><button type="button" disabled={pending} title={announcement.isVisible ? "Ẩn thông báo" : "Hiện lại thông báo"} onClick={() => run(() => toggleClassAnnouncement(classroom.id, announcement.id))} className="rounded-lg p-2 text-navy-400 hover:bg-pastel-50">{announcement.isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button><button type="button" disabled={pending} title="Xóa thông báo" onClick={() => { if (window.confirm("Xóa vĩnh viễn thông báo này?")) run(() => deleteClassAnnouncement(classroom.id, announcement.id)); }} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="size-4" /></button></div></div></article>)}
      </div>
    </details>
  );
}

export function AdminClassesManager({ classes, students }: { classes: Classroom[]; students: Student[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [classSearch, setClassSearch] = useState("");
  const visibleClasses = useMemo(() => {
    const query = classSearch.trim().toLocaleLowerCase("vi");
    return query ? classes.filter((item) => `${item.code} ${item.name}`.toLocaleLowerCase("vi").includes(query)) : classes;
  }, [classSearch, classes]);
  function run(action: () => Promise<ClassActionResult>) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await action();
      setMessage(result.success ? "Đã lưu thay đổi." : result.error);
    });
  }
  return (
    <div className="space-y-6">
      {message && <p role="status" className="rounded-xl bg-pastel-100 px-4 py-3 text-sm text-navy-500">{message}</p>}
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-navy-300" /><input value={classSearch} onChange={(event) => setClassSearch(event.target.value)} className={`${input} mt-0 pl-9`} placeholder="Tìm lớp theo mã hoặc tên…" /></div>
      <details className="rounded-3xl border border-navy-100 bg-white p-5" open={classes.length === 0}>
        <summary className="cursor-pointer font-semibold text-navy-600">+ Tạo lớp mới</summary>
        <form action={(data) => run(() => createClass(data))} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-navy-500">Tên lớp<input className={input} name="name" required minLength={2} maxLength={100} /></label>
          <label className="text-sm text-navy-500">Trình độ<select className={input} name="level"><option value="BASIC">Cơ bản</option><option value="ADVANCED">Nâng cao</option></select></label>
          <p className="rounded-xl bg-pastel-50 px-3 py-2.5 text-xs text-navy-400 sm:col-span-2">Mã lớp dạng số sẽ được cấp tự động khi tạo lớp.</p>
          <ScheduleEditor />
          <label className="text-sm text-navy-500 sm:col-span-2">Mô tả<textarea className={input} name="description" rows={3} maxLength={1000} /></label>
          <button disabled={pending} className="w-fit rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Tạo lớp</button>
        </form>
      </details>

      <div className="grid grid-cols-1 gap-3">
        {visibleClasses.map((classroom) => (
          <details id={`class-${classroom.id}`} key={classroom.id} className="group scroll-mt-6 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm transition hover:border-navy-200 hover:shadow-md open:rounded-3xl target:ring-2 target:ring-navy-300">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 marker:hidden">
              <div className="min-w-0"><div className="flex flex-wrap gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${classroom.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{classroom.status === "ACTIVE" ? "Hoạt động" : "Lưu trữ"}</span><span className="rounded-full bg-pastel-100 px-2 py-0.5 text-[10px] font-semibold text-navy-500">{classroom.level === "ADVANCED" ? "Nâng cao" : "Cơ bản"}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-navy-500">{classroom.code}</span></div><h2 className="mt-1.5 truncate font-semibold text-navy-600">{classroom.name}</h2><p className="mt-1 line-clamp-1 text-xs text-navy-300">{formatClassSchedule(classroom.scheduleSlots, classroom.legacySchedule)}</p></div>
              <div className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-pastel-50 px-2.5 py-1 text-[11px] font-semibold text-navy-400">{classroom.counts.students} HS</span><ChevronDown className="mt-1 size-4 text-navy-300 transition-transform group-open:rotate-180" /></div>
            </summary>
            <div className="border-t border-navy-50 p-4">
              <div className="flex justify-end"><button disabled={pending} onClick={() => run(() => toggleClassArchive(classroom.id))} className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 px-3 py-2 text-xs font-semibold text-navy-500 disabled:opacity-50">{classroom.status === "ACTIVE" ? <Archive className="size-4" /> : <RotateCcw className="size-4" />}{classroom.status === "ACTIVE" ? "Lưu trữ lớp" : "Khôi phục lớp"}</button></div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px] text-navy-400">{[[classroom.counts.students, "Sĩ số"], [classroom.counts.documents, "Tài liệu"], [classroom.counts.questions, "Câu ôn"], [classroom.counts.exams, "Đề thi"]].map(([number, label]) => <div key={label} className="rounded-xl bg-pastel-50 p-2"><strong className="block text-base text-navy-600">{number}</strong>{label}</div>)}</div>
              <p className="mt-3 text-xs text-navy-300">{classroom.stats.participants} học sinh đã làm · {classroom.stats.attempts} lượt nộp · Điểm TB {classroom.stats.averageScore === null ? "—" : classroom.stats.averageScore.toFixed(2)}</p>
              <details className="mt-4 border-t border-navy-50 pt-3"><summary className="cursor-pointer text-sm font-semibold text-navy-500">Sửa thông tin</summary><form action={(data) => run(() => updateClass(classroom.id, data))} className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-navy-400">Tên lớp<input className={input} name="name" defaultValue={classroom.name} required /></label><div className="text-xs text-navy-400">Mã lớp<span className="mt-1 block rounded-xl border border-navy-100 bg-pastel-50 px-3 py-2.5 font-semibold text-navy-600">{classroom.code}</span></div><label className="text-xs text-navy-400">Trình độ<select className={input} name="level" defaultValue={classroom.level}><option value="BASIC">Cơ bản</option><option value="ADVANCED">Nâng cao</option></select></label><ScheduleEditor initialSlots={classroom.scheduleSlots} /><label className="text-xs text-navy-400 sm:col-span-2">Mô tả<textarea className={input} name="description" defaultValue={classroom.description ?? ""} rows={2} /></label><button disabled={pending} className="inline-flex w-fit items-center gap-1 rounded-full bg-navy-600 px-4 py-2 text-xs font-semibold text-white"><Save className="size-3.5" />Lưu</button></form></details>
              <StudentPicker classroom={classroom} students={students} pending={pending} run={run} />
              <AnnouncementManager classroom={classroom} pending={pending} run={run} />
            </div>
          </details>
        ))}
        {!visibleClasses.length && <p className="rounded-2xl border border-dashed border-navy-100 p-8 text-center text-sm text-navy-300">Không có lớp phù hợp.</p>}
      </div>
    </div>
  );
}
