"use client";

import { SunMoon } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <label className={cn("flex min-h-11 items-center gap-2 rounded-xl border border-navy-100 bg-white px-3 text-xs font-semibold text-navy-500", className)}>
      <SunMoon className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">Giao diện</span>
      <select aria-label="Chọn giao diện" value={theme ?? "system"} onChange={(event) => setTheme(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 outline-none">
        <option value="light">Sáng</option>
        <option value="dark">Tối</option>
        <option value="system">Hệ thống</option>
      </select>
    </label>
  );
}
