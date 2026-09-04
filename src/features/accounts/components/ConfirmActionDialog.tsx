"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = hành động phá huỷ (thu hồi/từ chối) → nút chính màu đỏ. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-[1.5rem] bg-white p-6 shadow-[0_20px_60px_rgba(11,19,48,0.35)]"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-navy-500">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-navy-400">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-gray-100 px-5 py-2.5 text-sm font-medium text-navy-500 transition-colors hover:bg-gray-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors",
              danger ? "bg-red-600 hover:bg-red-700" : "bg-navy-500 hover:bg-navy-600",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
