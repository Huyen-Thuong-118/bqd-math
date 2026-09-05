"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Minus, Plus } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function PdfCanvasViewer({
  title,
  fileUrl,
  allowDownload = false,
  watermark,
  muted = false,
}: {
  title: string;
  fileUrl: string;
  allowDownload?: boolean;
  watermark?: string;
  muted?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [width, setWidth] = useState(520);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const updateWidth = () => setWidth(Math.max(260, element.clientWidth - 32));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className={`protected-pdf overflow-hidden rounded-3xl border border-navy-100 bg-white ${muted ? "opacity-80" : ""}`}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-navy-600">{title}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Thu nhỏ"
            onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}
            className="rounded-full p-2 text-navy-400 hover:bg-pastel-50"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-12 text-center text-xs text-navy-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Phóng to"
            onClick={() => setZoom((value) => Math.min(2, value + 0.1))}
            className="rounded-full p-2 text-navy-400 hover:bg-pastel-50"
          >
            <Plus className="size-4" />
          </button>
          {allowDownload && (
            <a
              href={`${fileUrl}?download=1`}
              className="ml-1 rounded-full p-2 text-navy-400 hover:bg-pastel-50"
              aria-label="Tải PDF"
            >
              <Download className="size-4" />
            </a>
          )}
        </div>
      </div>
      <div ref={viewportRef} className="relative h-[34rem] overflow-auto bg-slate-100 p-4">
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setPages(numPages)}
          loading={<p className="py-16 text-center text-sm text-navy-300">Đang tải PDF…</p>}
          error={<p className="py-16 text-center text-sm text-red-600">Không thể hiển thị PDF.</p>}
        >
          <div className="mx-auto grid w-fit gap-4">
            {Array.from({ length: pages }, (_, index) => (
              <Page
                key={index + 1}
                pageNumber={index + 1}
                width={width * zoom}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="overflow-hidden rounded-sm shadow"
              />
            ))}
          </div>
        </Document>
        {watermark && (
          <div className="pointer-events-none sticky bottom-4 z-10 mx-auto w-fit -rotate-6 rounded-lg bg-white/55 px-3 py-1 text-xs font-semibold text-navy-300 select-none">
            {watermark}
          </div>
        )}
      </div>
    </section>
  );
}
