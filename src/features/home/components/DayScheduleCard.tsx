"use client";

import { motion } from "motion/react";
import { CalendarDays, CalendarOff, Clock, MapPin, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { LEVEL_LABEL, type DaySchedule } from "../types";

/**
 * 1 ngày trong tuần = 1 card kính pastel, bên trong liệt kê các buổi học.
 *
 * Lịch luôn hiện ĐỦ 7 ngày (xem groupByDay trong features/home/data.ts) nên
 * card phải xử lý cả ngày TRỐNG: khi đó nhạt hơn, viền nét đứt, icon đổi
 * sang CalendarOff và thay danh sách buổi học bằng dòng "Chưa có lịch học".
 * Nhạt + nét đứt + icon khác => phân biệt được ngay cả khi không đọc chữ.
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
  const hasSessions = day.sessions.length > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.08 }}
      className={cn(
        "schedule-day-card group relative overflow-hidden rounded-[2rem] p-5 backdrop-blur-xl transition-all duration-300 sm:p-6",
        hasSessions
          ? "border border-white/40 bg-pastel-100/60 shadow-[0_8px_32px_rgba(27,42,74,0.12)] hover:-translate-y-1.5 hover:shadow-[0_18px_44px_rgba(27,42,74,0.22)]"
          : "border border-dashed border-navy-200/50 bg-pastel-50/40 shadow-none",
      )}
      data-has-sessions={hasSessions}
    >
      {/* Vệt sáng góc trên phải, đậm dần khi hover — hiệu ứng "glow".
          Ngày trống không có: card phải trông "im lìm" hơn ngày có lớp. */}
      {hasSessions && (
        <div className="schedule-day-glow pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br from-pastel-400/40 to-navy-200/40 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
      )}

      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "schedule-day-icon flex size-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm",
            hasSessions
              ? "border-white/60 bg-white/60 text-navy-500"
              : "border-navy-100/60 bg-white/40 text-navy-300",
          )}
        >
          {hasSessions ? (
            <CalendarDays className="size-6" aria-hidden />
          ) : (
            <CalendarOff className="size-6" aria-hidden />
          )}
        </span>
        <div>
          <h3
            className={cn(
              "text-lg font-semibold sm:text-xl",
              hasSessions ? "text-navy-600" : "text-navy-400",
            )}
          >
            {day.day}
          </h3>
          <p className="text-sm text-navy-300">
            {hasSessions ? `${day.sessions.length} buổi học` : "Ngày nghỉ"}
          </p>
        </div>
      </div>

      {hasSessions ? (
        <ul className="relative mt-5 space-y-3">
          {day.sessions.map((session) => (
            <li
              key={session.id}
              className="schedule-session-card rounded-2xl border border-white/50 bg-white/45 p-3.5 transition-colors group-hover:bg-white/65"
            >
              <div className="flex items-center gap-2 text-base font-medium text-navy-500">
                <Clock className="size-4 shrink-0 text-navy-300" aria-hidden />
                <time>
                  {session.startTime} - {session.endTime}
                </time>
              </div>

              <p className="mt-1 text-sm text-navy-400">{session.className}</p>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "schedule-level-badge rounded-full px-2.5 py-1 text-xs font-medium",
                    session.level === "ADVANCED"
                      ? "schedule-level-advanced bg-navy-500 text-pastel-50"
                      : "schedule-level-basic bg-pastel-200 text-navy-500",
                  )}
                >
                  {LEVEL_LABEL[session.level]}
                </span>
                {session.mode && <span className="schedule-mode-badge inline-flex items-center gap-1 rounded-full border border-navy-100 px-2.5 py-1 text-xs text-navy-400">{session.mode === "Online" ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}{session.mode}</span>}
                {session.status === "ARCHIVED" && <span className="schedule-archived-badge rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Đã lưu trữ</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="schedule-empty-state relative mt-5 rounded-2xl border border-dashed border-navy-200/50 px-3.5 py-6 text-center text-sm text-navy-300">
          Chưa có lịch học
        </p>
      )}
    </motion.article>
  );
}
