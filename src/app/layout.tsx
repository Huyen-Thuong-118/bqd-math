import type { Metadata } from "next";
import { Comfortaa, Noto_Serif_Display } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
});

// Chỉ dùng cho câu quote ở Hero (xem --font-slogan trong globals.css).
// Variable font nên không cần khai báo `weight`.
const notoSerifDisplay = Noto_Serif_Display({
  variable: "--font-noto-serif-display",
  subsets: ["latin", "vietnamese"],
  style: ["italic"],
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
    <html
      lang="vi"
      className={`${comfortaa.variable} ${notoSerifDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-pastel-100 text-navy-500 font-sans">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
