import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

// Route group (public): các trang KHÔNG cần đăng nhập — Trang chủ, Liên hệ.
// (public) và (student) không xuất hiện trong URL, chỉ để phân nhóm code.
export default function PublicLayout({
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
