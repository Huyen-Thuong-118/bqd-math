"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { GraduationCap } from "lucide-react";

import { getNextExamTimestamp } from "../exam-date";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function getRemaining(targetMs: number): Remaining {
  const totalSeconds = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
  return { days: Math.floor(totalSeconds / 86_400), hours: Math.floor((totalSeconds % 86_400) / 3600), minutes: Math.floor((totalSeconds % 3600) / 60), seconds: totalSeconds % 60 };
}

const UNITS: { key: keyof Remaining; label: string }[] = [
  { key: "days", label: "Ngày" },
  { key: "hours", label: "Giờ" },
  { key: "minutes", label: "Phút" },
  { key: "seconds", label: "Giây" },
];

export function ExamCountdown() {
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  useEffect(() => {
    const targetMs = getNextExamTimestamp();
    function tick() { setRemaining(getRemaining(targetMs)); }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative py-6 sm:py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.5, ease: "easeOut" }} className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-[2rem] border border-white/40 bg-pastel-100/60 p-6 text-center shadow-[0_8px_32px_rgba(27,42,74,0.12)] backdrop-blur-xl sm:p-8">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-navy-500 sm:text-base"><GraduationCap className="size-5" aria-hidden />Đếm ngược đến kỳ thi tốt nghiệp THPT Quốc gia</p>
        <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
          {UNITS.map((unit) => (
            <div key={unit.key} className="flex flex-col items-center gap-1 rounded-2xl border border-white/50 bg-white/60 px-3 py-3 sm:px-5 sm:py-4">
              <span className="font-mono text-2xl font-bold tabular-nums text-navy-600 sm:text-4xl">{remaining ? String(remaining[unit.key]).padStart(2, "0") : "--"}</span>
              <span className="text-xs text-navy-400 sm:text-sm">{unit.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
