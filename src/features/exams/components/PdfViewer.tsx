"use client";

import dynamic from "next/dynamic";

const PdfCanvasViewer = dynamic(() => import("./PdfCanvasViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center text-sm text-navy-300">
      Đang mở PDF…
    </div>
  ),
});

export function PdfViewer(props: {
  title: string;
  fileUrl?: string;
  allowDownload?: boolean;
  watermark?: string;
  unavailableMessage?: string;
  muted?: boolean;
}) {
  if (!props.fileUrl) {
    return (
      <section
        className={`overflow-hidden rounded-3xl border border-navy-100 bg-white ${props.muted ? "opacity-70" : ""}`}
      >
        <h2 className="border-b border-navy-100 px-4 py-3 text-sm font-semibold text-navy-600">
          {props.title}
        </h2>
        <div className="flex h-80 items-center justify-center px-6 text-center text-sm text-navy-300">
          {props.unavailableMessage ?? "Chưa có file PDF."}
        </div>
      </section>
    );
  }

  return <PdfCanvasViewer {...props} fileUrl={props.fileUrl} />;
}
