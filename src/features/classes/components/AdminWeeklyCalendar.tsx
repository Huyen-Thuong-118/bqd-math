import { CalendarDays, Clock3 } from "lucide-react";

import type { ClassSession, DaySchedule } from "@/features/home/types";

const HOUR_HEIGHT = 52;

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function layoutSessions(sessions: ClassSession[]) {
  const columnEnds: number[] = [];
  const positioned = [...sessions]
    .sort((left, right) => minutes(left.startTime) - minutes(right.startTime))
    .map((session) => {
      const start = minutes(session.startTime);
      let column = columnEnds.findIndex((end) => end <= start);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = minutes(session.endTime);
      return { session, column };
    });
  const columns = Math.max(columnEnds.length, 1);
  return positioned.map((item) => ({ ...item, columns }));
}

export function AdminWeeklyCalendar({ schedule, classCount, sessionCount }: { schedule: DaySchedule[]; classCount: number; sessionCount: number }) {
  const allSessions = schedule.flatMap((day) => day.sessions);
  const earliest = allSessions.length ? Math.min(...allSessions.map((session) => Math.floor(minutes(session.startTime) / 60))) : 6;
  const latest = allSessions.length ? Math.max(...allSessions.map((session) => Math.ceil(minutes(session.endTime) / 60))) : 22;
  const startHour = Math.max(0, Math.min(6, earliest));
  const endHour = Math.min(24, Math.max(22, latest));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const calendarHeight = (endHour - startHour) * HOUR_HEIGHT;

  return (
    <section id="lich-day" className="flex max-h-[calc(100vh-2rem)] scroll-mt-6 flex-col overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-sm">
      <div className="shrink-0 border-b border-navy-100 p-4 2xl:flex 2xl:items-start 2xl:justify-between 2xl:gap-3">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold text-navy-600"><CalendarDays className="size-5" />Lịch dạy trong tuần</h2><p className="mt-1 text-sm text-navy-300">Đồng bộ tự động từ lịch của từng lớp. Bấm vào một buổi để đi tới lớp cần chỉnh.</p></div>
        <div className="mt-3 flex shrink-0 flex-wrap gap-2 text-xs text-navy-500 2xl:mt-0"><span className="rounded-full bg-pastel-100 px-3 py-2"><strong>{classCount}</strong> lớp</span><span className="rounded-full bg-pastel-100 px-3 py-2"><strong>{sessionCount}</strong> buổi/tuần</span></div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[780px]">
          <div className="sticky top-0 z-20 grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-navy-100 bg-white">
            <div className="flex items-center justify-center border-r border-navy-100 text-[10px] font-semibold uppercase text-navy-300">GMT+7</div>
            {schedule.map((day) => <div key={day.dayOfWeek} className="border-r border-navy-100 px-2 py-3 text-center last:border-r-0"><p className="text-xs font-semibold uppercase tracking-wide text-navy-300">{day.day}</p><p className="mt-1 text-xs text-navy-400">{day.sessions.length} buổi</p></div>)}
          </div>
          <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))]">
            <div className="relative border-r border-navy-100 bg-slate-50/50" style={{ height: calendarHeight }}>
              {hours.map((hour, index) => <div key={hour} className="absolute right-2 flex -translate-y-1/2 items-center gap-1 text-[11px] text-navy-300" style={{ top: index * HOUR_HEIGHT }}><Clock3 className="size-3" />{String(hour).padStart(2, "0")}:00</div>)}
            </div>
            {schedule.map((day) => <div key={day.dayOfWeek} className="relative border-r border-navy-100 last:border-r-0" style={{ height: calendarHeight, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT - 1}px, rgb(225 231 242) ${HOUR_HEIGHT}px)`, backgroundSize: `100% ${HOUR_HEIGHT}px` }}>{layoutSessions(day.sessions).map(({ session, column, columns }) => {
              const top = ((minutes(session.startTime) - startHour * 60) / 60) * HOUR_HEIGHT;
              const height = Math.max(((minutes(session.endTime) - minutes(session.startTime)) / 60) * HOUR_HEIGHT, 32);
              const isAdvanced = session.level === "ADVANCED";
              return <a key={session.id} href={`#class-${session.classId}`} aria-label={`${session.className}, ${session.startTime} đến ${session.endTime}`} className={`absolute z-10 overflow-hidden rounded-lg border-l-4 p-2 text-left shadow-sm transition hover:z-20 hover:brightness-95 ${isAdvanced ? "border-navy-600 bg-navy-100 text-navy-700" : "border-sky-500 bg-sky-50 text-sky-900"} ${session.status === "ARCHIVED" ? "border-dashed opacity-55" : ""}`} style={{ top: top + 2, height: height - 4, left: `calc(${(column / columns) * 100}% + 3px)`, width: `calc(${100 / columns}% - 6px)` }}><strong className="block truncate text-xs">{session.className}</strong><span className="mt-0.5 block text-[10px] font-medium">{session.startTime}–{session.endTime}</span><span className="mt-0.5 block truncate text-[10px]">{isAdvanced ? "Nâng cao" : "Cơ bản"}{session.status === "ARCHIVED" ? " · Lưu trữ" : ""}</span></a>;
            })}</div>)}
          </div>
        </div>
      </div>
    </section>
  );
}
