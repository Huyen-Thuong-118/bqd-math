import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getOptionalUnreadNotificationCount } from "@/features/notifications/queries";

// Route group (public): các trang KHÔNG cần đăng nhập — Trang chủ, Liên hệ.
// (public) và (student) không xuất hiện trong URL, chỉ để phân nhóm code.
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const unreadNotificationCount = await getOptionalUnreadNotificationCount();
  return (
    <>
      <Navbar unreadNotificationCount={unreadNotificationCount} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <Footer />
    </>
  );
}
