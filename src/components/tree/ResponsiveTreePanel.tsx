"use client";

import { FolderTree, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ResponsiveTreePanelProps = {
  title: string;
  triggerLabel: string;
  children: ReactNode;
  className?: string;
};

export function ResponsiveTreePanel({
  title,
  triggerLabel,
  children,
  className,
}: ResponsiveTreePanelProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("[data-tree-drawer-close]")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-navy-100 bg-white px-4 py-3 text-sm font-semibold text-navy-600 shadow-sm md:hidden"
      >
        <FolderTree className="size-4" aria-hidden="true" />
        {triggerLabel}
      </button>

      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Đóng ${title}`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] bg-navy-700/45 backdrop-blur-[1px] md:hidden"
        />
      )}

      <section
        ref={panelRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? title : undefined}
        className={cn(
          open
            ? "fixed inset-y-0 left-0 z-[70] block w-[min(24rem,92vw)] overflow-x-hidden overflow-y-auto bg-pastel-50 p-4 shadow-2xl"
            : "hidden",
          "md:static md:z-auto md:block md:w-auto md:overflow-visible md:bg-transparent md:p-0 md:shadow-none",
          className,
        )}
      >
        <div className="sticky top-0 z-10 mb-4 flex min-h-11 items-center justify-between gap-3 border-b border-navy-100 bg-pastel-50 pb-3 md:hidden">
          <h2 className="font-semibold text-navy-600">{title}</h2>
          <button
            data-tree-drawer-close
            type="button"
            aria-label={`Đóng ${title}`}
            onClick={() => setOpen(false)}
            className="inline-flex size-11 items-center justify-center rounded-full text-navy-500 hover:bg-pastel-100"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </>
  );
}
