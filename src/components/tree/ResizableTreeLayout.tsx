"use client";

import { GripVertical, LayoutGrid, ListTree } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

const DEFAULT_WIDTH = 496;
const MIN_WIDTH = 360;
const MAX_WIDTH = 760;
const MIN_CONTENT_WIDTH = 420;
const RESIZE_STEP = 24;

function clampTreeWidth(width: number, containerWidth = 0) {
  const availableMaximum = containerWidth
    ? Math.max(MIN_WIDTH, containerWidth - MIN_CONTENT_WIDTH - 32)
    : MAX_WIDTH;
  return Math.round(Math.max(MIN_WIDTH, Math.min(width, MAX_WIDTH, availableMaximum)));
}

export function ResizableTreeLayout({
  storageKey,
  tree,
  content,
  grid,
}: {
  storageKey: string;
  tree: ReactNode;
  content: ReactNode;
  grid: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const restoredRef = useRef(false);
  const [treeWidth, setTreeWidth] = useState(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"tree" | "grid">("tree");

  function clampWidth(width: number) {
    return clampTreeWidth(width, containerRef.current?.clientWidth);
  }

  function updateWidth(width: number) {
    setTreeWidth(clampWidth(width));
  }

  useEffect(() => {
    let savedWidth = DEFAULT_WIDTH;
    try {
      const raw = window.localStorage.getItem(storageKey);
      const stored = raw === null ? Number.NaN : Number(raw);
      if (Number.isFinite(stored)) savedWidth = stored;
    } catch {
      // localStorage có thể bị chặn.
    }
    const frame = window.requestAnimationFrame(() => {
      restoredRef.current = true;
      setTreeWidth(clampTreeWidth(savedWidth, containerRef.current?.clientWidth));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(`${storageKey}:layout`);
    } catch {
      // localStorage có thể bị chặn.
    }
    if (saved !== "grid" && saved !== "drive") return;
    const frame = window.requestAnimationFrame(() => setLayoutMode("grid"));
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      window.localStorage.setItem(storageKey, String(treeWidth));
    } catch {
      // localStorage có thể bị chặn.
    }
  }, [storageKey, treeWidth]);

  useEffect(() => {
    function handleResize() {
      if (!window.matchMedia("(min-width: 80rem)").matches) return;
      setTreeWidth((current) => clampTreeWidth(current, containerRef.current?.clientWidth));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: treeWidth };
    setResizing(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    updateWidth(dragRef.current.startWidth + event.clientX - dragRef.current.startX);
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setResizing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") updateWidth(treeWidth - RESIZE_STEP);
    if (event.key === "ArrowRight") updateWidth(treeWidth + RESIZE_STEP);
    if (event.key === "Home") updateWidth(MIN_WIDTH);
    if (event.key === "End") updateWidth(MAX_WIDTH);
  }

  function chooseLayout(mode: "tree" | "grid") {
    setLayoutMode(mode);
    try {
      window.localStorage.setItem(`${storageKey}:layout`, mode);
    } catch {
      // localStorage có thể bị chặn.
    }
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-xl border border-navy-100 bg-white p-1 shadow-sm" role="group" aria-label="Chế độ quản lý thư mục">
          <LayoutButton active={layoutMode === "tree"} onClick={() => chooseLayout("tree")} icon={<ListTree />} label="Dạng cây" />
          <LayoutButton active={layoutMode === "grid"} onClick={() => chooseLayout("grid")} icon={<LayoutGrid />} label="Dạng lưới" />
        </div>
      </div>
      <div
        ref={containerRef}
        style={{ "--tree-panel-width": `${treeWidth}px` } as CSSProperties}
        className={`grid min-w-0 items-start gap-y-5 xl:grid-cols-[var(--tree-panel-width)_1rem_minmax(0,1fr)] xl:gap-x-2 ${resizing ? "select-none" : ""}`}
      >
        {layoutMode === "tree" ? tree : grid}
        <div
          role="separator"
          aria-label="Điều chỉnh độ rộng khu vực thư mục"
          aria-orientation="vertical"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={treeWidth}
          tabIndex={0}
          title="Kéo sang trái hoặc phải để đổi độ rộng"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
          onDoubleClick={() => updateWidth(DEFAULT_WIDTH)}
          onKeyDown={handleKeyDown}
          className="group/splitter relative hidden h-[calc(100vh-2.5rem)] min-h-80 touch-none cursor-col-resize items-center justify-center self-start rounded-full outline-none xl:sticky xl:top-5 xl:flex focus-visible:ring-2 focus-visible:ring-navy-400"
        >
          <span className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition ${resizing ? "bg-navy-400" : "bg-navy-100 group-hover/splitter:bg-navy-300"}`} />
          <span className={`relative flex h-12 w-4 items-center justify-center rounded-full border bg-white shadow-sm transition ${resizing ? "border-navy-400 text-navy-600" : "border-navy-100 text-navy-300 group-hover/splitter:border-navy-300 group-hover/splitter:text-navy-500"}`}>
            <GripVertical className="size-3.5" aria-hidden="true" />
          </span>
        </div>
        {content}
      </div>
    </div>
  );
}

function LayoutButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-navy-600 text-white shadow-sm" : "text-navy-400 hover:bg-pastel-50 hover:text-navy-600"}`}>
      <span className="[&>svg]:size-4">{icon}</span>{label}
    </button>
  );
}
