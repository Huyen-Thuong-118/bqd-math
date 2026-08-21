"use client";

import { motion } from "motion/react";

import { weeklySchedule } from "../data";
import { DayScheduleCard } from "./DayScheduleCard";

/**
 * Khối "Lịch giảng dạy" ở Trang chủ — mỗi ngày CÓ lớp là 1 card.
 * Ngày trống không render (xem groupByDay trong features/home/data.ts).
 *
 * `scroll-mt-32` để khi bấm CTA "Xem lịch học" ở Hero, tiêu đề không bị
 * thanh nav nổi (sticky) che mất.
 */
export function ScheduleSection() {
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
        <h2 className="text-2xl font-semibold text-navy-600 sm:text-3xl">
          Lịch giảng dạy
        </h2>
        <p className="text-sm text-navy-400 sm:text-base">
          Lịch học trong tuần của lớp Cơ bản và Nâng cao — chọn buổi phù hợp với
          lộ trình của em.
        </p>
      </motion.header>

      {/* items-start: card cao theo đúng số buổi học, ngày ít buổi không bị
          kéo dài bằng ngày nhiều buổi rồi chừa 1 khoảng trống lớn */}
      {weeklySchedule.length === 0 ? (
        <p className="rounded-[2rem] border border-white/40 bg-pastel-100/60 p-8 text-center text-sm text-navy-400 backdrop-blur-xl">
          Chưa có lịch học nào được cập nhật.
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {weeklySchedule.map((day, index) => (
            <DayScheduleCard key={day.dayOfWeek} day={day} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}
