"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { CalendarX2 } from "lucide-react";

import { WeeklyScheduleGrid } from "@/features/classes/components/WeeklyScheduleGrid";
import { useSessionStatuses } from "../hooks/useSessionStatuses";
import type { DaySchedule } from "../types";

export function StudentScheduleSection({ studentName, schedule, classCount, sessionCount }: { studentName: string; schedule: DaySchedule[]; classCount: number; sessionCount: number }) {
  const allSessions = useMemo(() => schedule.flatMap((day) => day.sessions), [schedule]);
  const statusMap = useSessionStatuses(allSessions);
  return (
    <section id="lich-giang-day" className="relative scroll-mt-32 py-12 sm:py-16">
      <div className="pointer-events-none absolute top-10 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-gradient-to-br from-pastel-300/40 to-navy-100/40 blur-3xl" />
      <motion.header initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, ease: "easeOut" }} className="mb-8 flex flex-col gap-3 text-center sm:mb-10">
        <h2 className="text-3xl font-semibold text-navy-600 sm:text-4xl">Lịch học của {studentName}</h2>
        <p className="text-base text-navy-400 sm:text-lg">Chỉ hiển thị lịch của những lớp em đã được duyệt và xếp vào.</p>
        {sessionCount > 0 && <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-navy-500"><span className="rounded-full bg-pastel-100 px-4 py-2"><strong>{classCount}</strong> lớp</span><span className="rounded-full bg-pastel-100 px-4 py-2"><strong>{sessionCount}</strong> buổi/tuần</span></div>}
      </motion.header>
      {sessionCount > 0 ? <WeeklyScheduleGrid schedule={schedule} statusMap={statusMap} /> : <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-dashed border-navy-200 bg-white/60 p-12 text-center text-sm text-navy-400"><CalendarX2 className="size-8 text-navy-300" aria-hidden />Em chưa được xếp vào lớp có lịch học.</div>}
    </section>
  );
}
