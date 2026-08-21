"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";

import { MathGlassVisual } from "./MathGlassVisual";

// TODO: thay câu quote thật
const INSPIRING_QUOTE =
  "Toán học không phải để ghi nhớ công thức, mà để rèn khả năng nhìn ra quy luật đằng sau mọi vấn đề.";

/** Bọc ngoài: không tự animate, chỉ điều phối các con hiện lần lượt. */
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

/** Fade + trượt lên nhẹ khi vào khung nhìn — dùng lại cho từng dòng của Hero. */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function HeroSection() {
  return (
    // Không dùng overflow-hidden ở đây: nó cắt blob thành hình chữ nhật lộ mép.
    // Thay vào đó blob không được tràn sang PHẢI (sẽ sinh thanh cuộn ngang trên
    // mobile) — tràn sang trái thì vô hại vì trình duyệt LTR không cuộn ngược.
    <section className="relative -mt-2 py-10 sm:py-16">
      {/* Blob nền cho cả khối Hero, nằm dưới mọi nội dung */}
      <div className="pointer-events-none absolute -top-24 -left-24 -z-10 size-72 rounded-full bg-gradient-to-br from-navy-200/40 to-pastel-200/60 blur-3xl" />
      <div className="pointer-events-none absolute top-32 right-0 -z-10 size-80 rounded-full bg-gradient-to-tr from-pastel-400/30 to-navy-100/50 blur-3xl" />

      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-8">
        {/* --- Cột trái: quote + mô tả + CTA --- */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="flex flex-col items-start gap-6"
        >
          <motion.span
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-pastel-50/70 px-4 py-1.5 text-xs font-medium text-navy-400 shadow-[0_8px_24px_rgba(27,42,74,0.1)] backdrop-blur-xl sm:text-sm"
          >
            <Sparkles className="size-4 text-navy-300" aria-hidden />
            Ôn luyện &amp; thi thử Toán cùng BQD Math
          </motion.span>

          <motion.h1
            variants={fadeUp}
            className="text-2xl leading-snug font-semibold text-balance text-navy-600 sm:text-3xl lg:text-4xl lg:leading-tight"
          >
            &ldquo;{INSPIRING_QUOTE}&rdquo;
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-xl text-sm leading-relaxed text-navy-400 sm:text-base"
          >
            {/* TODO: thay bằng mô tả thật về trung tâm */}
            BQD Math đồng hành cùng học sinh qua từng chương: câu hỏi ôn tập bám
            sát chương trình, phòng thi thử chấm điểm tự động và kho tài liệu
            được cập nhật liên tục. Lớp Cơ bản và Nâng cao học song song, chọn
            đúng lộ trình phù hợp với mình.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center gap-3"
          >
            <a
              href="#lich-giang-day"
              className="group inline-flex items-center gap-2 rounded-full bg-navy-500 px-6 py-3 text-sm font-medium text-pastel-50 shadow-[0_8px_24px_rgba(27,42,74,0.28)] transition-all hover:-translate-y-0.5 hover:bg-navy-600 hover:shadow-[0_12px_32px_rgba(27,42,74,0.35)]"
            >
              <CalendarDays className="size-4" aria-hidden />
              Xem lịch học
            </a>
            <Link
              href="/thi-thu"
              className="group inline-flex items-center gap-2 rounded-full border border-white/60 bg-pastel-50/70 px-6 py-3 text-sm font-medium text-navy-500 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/80"
            >
              Vào phòng thi thử
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          </motion.div>
        </motion.div>

        {/* --- Cột phải: minh hoạ toán học (xuống dưới ở mobile) --- */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          className="order-last"
        >
          <MathGlassVisual />
        </motion.div>
      </div>
    </section>
  );
}
