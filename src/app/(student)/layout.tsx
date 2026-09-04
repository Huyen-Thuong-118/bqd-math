import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

// Route group (student): Lớp học, Ôn tập, Thi thử, Tài liệu.
// Auth check (chưa đăng nhập / PENDING / SUSPENDED) đã chặn ở src/proxy.ts
// trước khi request tới được layout này — xem matcher trong file đó.
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <Footer />
    </>
  );
}
