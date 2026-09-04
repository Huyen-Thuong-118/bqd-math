import Link from "next/link";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { MathDoodles } from "@/features/auth/components/MathDoodles";

// Route group (auth): Đăng nhập/Đăng ký/Quên mật khẩu — layout split-screen
// riêng, KHÔNG dùng Navbar/Footer của (public).
//
// Guard: user đã đăng nhập không được vào lại /dang-nhap, /dang-ky,
// /quen-mat-khau — tránh nhầm lẫn kiểu "đăng ký xong tưởng đã vào được tài
// khoản admin" trong khi thực ra chỉ đang thấy session cũ còn sống. Điều
// hướng đúng nơi theo role/status, giống hệt logic trong src/proxy.ts.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "ADMIN") redirect("/admin");
    if (session.user.status === "PENDING") redirect("/cho-duyet");
    if (session.user.status === "SUSPENDED") redirect("/tai-khoan-bi-khoa");
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Panel trái — ẩn hoàn toàn dưới md, chỉ còn panel phải full width */}
      <div className="relative hidden w-full flex-col justify-between overflow-hidden bg-linear-to-b from-galaxy-900 to-galaxy-800 px-10 py-10 text-pastel-50 md:flex md:w-[42%] lg:w-[38%]">
        <MathDoodles />

        <Link href="/" className="relative z-10 text-2xl font-semibold tracking-tight">
          BQD<span className="text-pastel-400">Math</span>
        </Link>

        <div className="relative z-10 flex flex-col gap-3 pb-16">
          <h1 className="text-3xl leading-snug font-semibold text-balance">
            Ôn luyện Toán học có định hướng, thi thử như thi thật.
          </h1>
          <p className="text-sm leading-relaxed text-pastel-200">
            Đăng nhập để theo dõi lịch học, làm bài ôn tập và vào phòng thi thử
            cùng BQD Math.
          </p>
        </div>

        {/* Dải sóng cong trang trí phía dưới panel — 2 lớp mờ chồng nhau tạo
            chiều sâu, không giành sự chú ý với nội dung phía trên. */}
        <svg
          aria-hidden
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full"
        >
          <path
            fill="var(--color-pastel-400)"
            fillOpacity="0.08"
            d="M0,120 C100,180 300,40 400,100 L400,200 L0,200 Z"
          />
          <path
            fill="var(--color-pastel-400)"
            fillOpacity="0.12"
            d="M0,150 C120,90 280,190 400,140 L400,200 L0,200 Z"
          />
        </svg>
      </div>

      {/* Panel phải — form, căn giữa theo chiều dọc */}
      <div className="flex w-full flex-1 items-center justify-center bg-pastel-100 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-[0_20px_60px_rgba(27,42,74,0.12)] sm:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}
