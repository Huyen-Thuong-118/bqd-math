import "dotenv/config";

import { db } from "../src/lib/db";

const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

async function signIn(identifier: string, password: string) {
  const csrf = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrf.ok) throw new Error(`Không lấy được CSRF (${csrf.status}).`);
  const { csrfToken } = await csrf.json() as { csrfToken: string };
  const csrfCookie = csrf.headers.get("set-cookie")?.split(";")[0] ?? "";
  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-auth-return-redirect": "1", cookie: csrfCookie },
    body: new URLSearchParams({ identifier, password, csrfToken, callbackUrl: `${baseUrl}/sau-dang-nhap` }),
    redirect: "manual",
  });
  const sessionCookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).find((value) => value.includes("session-token"));
  if (!response.ok || !sessionCookie) throw new Error(`Đăng nhập thất bại (${response.status}).`);
  return `${csrfCookie}; ${sessionCookie}`;
}

async function probe(label: string, cookie: string, paths: string[]) {
  for (const path of paths) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: "follow" });
    console.log(`${label.padEnd(7)} ${path.padEnd(30)} ${response.status} -> ${new URL(response.url).pathname}`);
    if (response.status >= 500) {
      const body = await response.text();
      const messages = [...body.matchAll(/(?:message|error)\\?\"?\s*:\s*\\?\"([^\"\\]+(?:\\.[^\"\\]*)*)/gi)].map((match) => match[1].replaceAll("\\n", " "));
      console.log(messages.slice(0, 3).join(" | ") || body.slice(0, 500));
    }
  }
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const studentEmail = process.env.SEED_STUDENT_EMAIL ?? "student@bqdmath.local";
  const studentPassword = process.env.SEED_STUDENT_PASSWORD ?? "BqdMathStudent123!";
  const testStudentPassword = process.env.SEED_TEST_STUDENT_PASSWORD ?? "HocSinh@123";
  if (!adminEmail || !adminPassword) throw new Error("Thiếu SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD.");
  const exam = await db.exam.findFirst({ select: { id: true }, orderBy: { createdAt: "desc" } });
  const [adminCookie, studentCookie, testStudentCookie] = await Promise.all([signIn(adminEmail, adminPassword), signIn(studentEmail, studentPassword), signIn("hocsinh01@bqdmath.local", testStudentPassword)]);
  await probe("ADMIN", adminCookie, ["/admin", "/admin/lop-hoc", "/admin/lich-day", "/admin/tai-lieu", "/admin/cau-hoi-on-tap", "/admin/de-thi", "/admin/de-thi/tao-moi", ...(exam ? [`/admin/de-thi/${exam.id}/chinh-sua`] : [])]);
  await probe("STUDENT", studentCookie, ["/lop-hoc", "/lop-hoc/slice1-demo-class", "/lich-hoc", "/tai-lieu", "/on-tap", "/thi-thu"]);
  await probe("TEST HS", testStudentCookie, ["/lop-hoc", "/lop-hoc/test-class-02", "/lich-hoc"]);
  await db.$disconnect();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
