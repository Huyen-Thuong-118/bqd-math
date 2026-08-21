import type { Metadata } from "next";
import { Comfortaa } from "next/font/google";
import "./globals.css";

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BQD Math | Ôn luyện & Thi thử Toán",
  description:
    "Hệ thống ôn luyện và thi thử Toán học — đề thi, câu hỏi ôn tập theo chương, phòng thi thử có chấm điểm.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${comfortaa.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-pastel-100 text-navy-500 font-sans">
        {children}
      </body>
    </html>
  );
}
