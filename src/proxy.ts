import { auth } from "@/auth";
import { hasCurrentCredentialVersion } from "@/features/auth/lib/credential-version";
import { db } from "@/lib/db";

// Next.js 16 đã đổi tên file convention "middleware.ts" -> "proxy.ts" (hành vi
// giữ nguyên, chỉ đổi tên file/export — xem node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/proxy.md). "middleware.ts" vẫn được
// nhận nhưng đã deprecated, nên dùng tên mới ở đây.
//
// KHÔNG khai báo `export const runtime = "nodejs"`: đã tự kiểm chứng (build
// thật) rằng Next.js 16 CẤM mọi Route Segment Config (kể cả `runtime`) trong
// file Proxy — khai báo vào sẽ lỗi build "Route segment config is not
// allowed in Proxy file". Không cần khai báo gì thêm vì Proxy ở bản này LUÔN
// chạy Node.js runtime mặc định (không còn Edge nữa), đúng thứ Prisma driver
// adapter cần — query DB bên dưới an toàn out of the box.
export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;

  const isAdminRoute = pathname.startsWith("/admin");
  const isStudentRoute = ["/lop-hoc", "/lich-hoc", "/on-tap", "/thi-thu", "/tai-lieu"].some(
    (p) => pathname.startsWith(p),
  );

  if (isAdminRoute) {
    if (!user) {
      return Response.redirect(new URL("/dang-nhap", req.url));
    }

    const current = await db.user.findUnique({
      where: { id: user.id },
      select: { role: true, status: true, credentialVersion: true },
    });
    if (
      !current ||
      current.role !== "ADMIN" ||
      !hasCurrentCredentialVersion(user.credentialVersion, current.credentialVersion)
    ) {
      return Response.redirect(new URL("/dang-nhap", req.url));
    }
    if (current.status === "SUSPENDED") {
      return Response.redirect(new URL("/tai-khoan-bi-khoa", req.url));
    }
  }

  if (isStudentRoute) {
    if (!user) return Response.redirect(new URL("/dang-nhap", req.url));

    // status có thể bị admin đổi bất cứ lúc nào (thu hồi/kích hoạt lại) mà
    // JWT chỉ đọc lại giá trị lúc đăng nhập — tin token ở đây nghĩa là 1 tài
    // khoản vừa bị SUSPENDED vẫn lọt vào được tới khi JWT hết hạn. Query
    // thẳng DB lấy giá trị MỚI NHẤT thay vì user.status từ token.
    const current = await db.user.findUnique({
      where: { id: user.id },
      select: {
        role: true,
        status: true,
        studentPhone: true,
        parentPhone: true,
        mustChangePassword: true,
        credentialVersion: true,
      },
    });

    // null: tài khoản đã bị cron job xoá hẳn sau 30 ngày SUSPENDED (xem
    // app/api/cron/cleanup-suspended-accounts) — coi như SUSPENDED, không
    // phân biệt để khỏi lộ "tài khoản không còn tồn tại".
    const status = current?.status ?? "SUSPENDED";

    if (status === "SUSPENDED") {
      return Response.redirect(new URL("/tai-khoan-bi-khoa", req.url));
    }
    if (current?.role !== "STUDENT") {
      return Response.redirect(new URL("/admin", req.url));
    }
    if (!hasCurrentCredentialVersion(user.credentialVersion, current.credentialVersion)) {
      return Response.redirect(new URL("/dang-nhap", req.url));
    }
    if (!current.studentPhone || !current.parentPhone) {
      return Response.redirect(new URL("/hoan-tat-ho-so", req.url));
    }
    if (status === "PENDING") {
      return Response.redirect(new URL("/cho-duyet", req.url));
    }
    if (current.mustChangePassword) {
      return Response.redirect(new URL("/doi-mat-khau", req.url));
    }
  }
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/lop-hoc/:path*",
    "/lich-hoc/:path*",
    "/on-tap/:path*",
    "/thi-thu/:path*",
    "/tai-lieu/:path*",
  ],
};
