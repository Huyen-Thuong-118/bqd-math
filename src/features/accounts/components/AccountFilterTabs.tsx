"use client";

import { cn } from "@/lib/utils";
import type { AccountFilter } from "../types";

const TABS: { value: AccountFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "SUSPENDED", label: "Ngưng hoạt động" },
];

export function AccountFilterTabs({
  value,
  onChange,
  counts,
}: {
  value: AccountFilter;
  onChange: (value: AccountFilter) => void;
  counts: Record<AccountFilter, number>;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-navy-100">
      {TABS.map((tab) => {
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              isActive ? "text-navy-600" : "text-navy-300 hover:text-navy-500",
            )}
          >
            {tab.label} ({counts[tab.value]})
            {isActive && (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-navy-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}
