import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

// Route group (student): Lớp học, Ôn tập, Thi thử, Tài liệu.
// TODO: bọc thêm auth check ở đây (redirect /login nếu chưa đăng nhập)
// khi features/auth có session helper — xem lib/auth.ts.
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
