"use client";

import { motion } from "motion/react";

import type { DaySchedule } from "../types";
import { DayScheduleCard } from "./DayScheduleCard";

/**
 * Khối "Lịch giảng dạy" ở Trang chủ — mỗi ngày trong tuần là 1 card.
 * Hiện ĐỦ 7 ngày; ngày không có lớp vẫn có card ở trạng thái "Chưa có lịch
 * học" (xem groupByDay trong features/home/data.ts và DayScheduleCard).
 *
 * `scroll-mt-32` để khi bấm CTA "Xem lịch học" ở Hero, tiêu đề không bị
 * thanh nav nổi (sticky) che mất.
 */
export function ScheduleSection({ schedule }: { schedule: DaySchedule[] }) {
  return (
    <section
      id="lich-giang-day"
      className="relative scroll-mt-32 py-12 sm:py-16"
    >
      {/* Blob nền cho cả section */}
      <div className="pointer-events-none absolute top-10 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-gradient-to-br from-pastel-300/40 to-navy-100/40 blur-3xl" />

      <motion.header
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8 flex flex-col gap-2 text-center sm:mb-10"
      >
        <h2 className="text-3xl font-semibold text-navy-600 sm:text-4xl">
          Lịch giảng dạy
        </h2>
        <p className="text-base text-navy-400 sm:text-lg">
          Lịch học trong tuần của lớp Cơ bản và Nâng cao — chọn buổi phù hợp với
          lộ trình của em.
        </p>
      </motion.header>

      {/* items-start: card cao theo đúng số buổi học, ngày ít buổi không bị
          kéo dài bằng ngày nhiều buổi rồi chừa 1 khoảng trống lớn.
          Không còn nhánh "chưa có lịch nào" cho cả section: groupByDay luôn
          trả về đủ 7 ngày nên nhánh đó là code chết — trạng thái trống giờ
          nằm ở TỪNG card. */}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {schedule.map((day, index) => (
          <DayScheduleCard key={day.dayOfWeek} day={day} index={index} />
        ))}
      </div>
    </section>
  );
}
