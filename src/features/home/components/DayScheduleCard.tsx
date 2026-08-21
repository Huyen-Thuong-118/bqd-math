"use client";

import { motion } from "motion/react";
import { CalendarDays, Clock, MapPin, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { LEVEL_LABEL, type DaySchedule } from "../types";

/**
 * 1 ngày trong tuần = 1 card kính pastel, bên trong liệt kê các buổi học.
 *
 * `index` chỉ dùng để delay animation — card thứ n xuất hiện sau card thứ
 * n-1 một nhịp ngắn (staggered) thay vì cả lưới hiện cùng lúc.
 */
export function DayScheduleCard({
  day,
  index,
}: {
  day: DaySchedule;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.08 }}
      className="group relative overflow-hidden rounded-[2rem] border border-white/40 bg-pastel-100/60 p-5 shadow-[0_8px_32px_rgba(27,42,74,0.12)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_18px_44px_rgba(27,42,74,0.22)] sm:p-6"
    >
      {/* Vệt sáng góc trên phải, đậm dần khi hover — hiệu ứng "glow" */}
      <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br from-pastel-400/40 to-navy-200/40 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/60 text-navy-500 shadow-sm">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <div>
          <h3 className="text-base font-semibold text-navy-600 sm:text-lg">
            {day.day}
          </h3>
          <p className="text-xs text-navy-300">
            {day.sessions.length} buổi học
          </p>
        </div>
      </div>

      <ul className="relative mt-5 space-y-3">
        {day.sessions.map((session) => (
          <li
            key={session.id}
            className="rounded-2xl border border-white/50 bg-white/45 p-3.5 transition-colors group-hover:bg-white/65"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-navy-500">
              <Clock className="size-4 shrink-0 text-navy-300" aria-hidden />
              <time>
                {session.startTime} - {session.endTime}
              </time>
            </div>

            <p className="mt-1 text-xs text-navy-400">{session.className}</p>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {/* 2 tông navy khác nhau để phân biệt ngay Cơ bản / Nâng cao */}
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  session.level === "ADVANCED"
                    ? "bg-navy-500 text-pastel-50"
                    : "bg-pastel-200 text-navy-500",
                )}
              >
                {LEVEL_LABEL[session.level]}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-navy-100 px-2.5 py-1 text-[11px] text-navy-400">
                {session.mode === "Online" ? (
                  <Video className="size-3" aria-hidden />
                ) : (
                  <MapPin className="size-3" aria-hidden />
                )}
                {session.mode}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}
