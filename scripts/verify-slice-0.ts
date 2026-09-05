import "dotenv/config";

import { randomUUID } from "node:crypto";

import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const password = "SliceZero123!";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function signInCredentials(identifier: string, credentialPassword: string) {
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  assert(csrfResponse.ok, "Không lấy được CSRF token. Dev server đã chạy chưa?");
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  const csrfCookie = csrfResponse.headers.get("set-cookie")?.split(";")[0] ?? "";

  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-auth-return-redirect": "1",
      cookie: csrfCookie,
    },
    body: new URLSearchParams({
      identifier,
      password: credentialPassword,
      csrfToken,
      callbackUrl: `${baseUrl}/sau-dang-nhap`,
    }),
  });
  const body = (await response.json()) as { url: string };
  const sessionCookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .find((value) => value.includes("session-token"));

  return {
    response,
    code: new URL(body.url).searchParams.get("code"),
    cookie: sessionCookie ? `${csrfCookie}; ${sessionCookie}` : undefined,
  };
}

async function expectRedirect(cookie: string, path: string, location: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: { cookie },
  });
  assert(
    response.headers.get("location") === location,
    `${path}: mong đợi redirect ${location}, nhận ${response.headers.get("location")}`,
  );
}

async function main() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const email = `slice0-${suffix}@example.test`;
  const phoneSuffix = String(Date.now()).slice(-8);
  const studentPhone = `09${phoneSuffix}`;
  const parentPhone = `08${phoneSuffix}`;
  const passwordHash = await hashPassword(password);

  const student = await db.user.create({
    data: {
      name: "Học sinh kiểm thử Slice 0",
      email,
      studentPhone,
      parentPhone,
      passwordHash,
      role: "STUDENT",
      status: "PENDING",
    },
  });

  try {
    const wrongPassword = await signInCredentials(email, "WrongPassword123!");
    assert(
      wrongPassword.code === "invalid-credentials",
      "Sai mật khẩu phải trả về invalid-credentials, không được lộ trạng thái.",
    );

    const pending = await signInCredentials(email, password);
    assert(pending.code === "account-pending", "User PENDING phải bị chặn login.");

    await db.user.update({ where: { id: student.id }, data: { status: "ACTIVE" } });
    const active = await signInCredentials(email, password);
    assert(active.response.ok && active.cookie, "User ACTIVE phải đăng nhập được.");
    await expectRedirect(active.cookie, "/sau-dang-nhap", "/lop-hoc");

    await db.user.update({
      where: { id: student.id },
      data: { status: "SUSPENDED", suspendedAt: new Date() },
    });
    await expectRedirect(active.cookie, "/lop-hoc", "/tai-khoan-bi-khoa");

    await db.user.update({
      where: { id: student.id },
      data: {
        status: "ACTIVE",
        suspendedAt: null,
        mustChangePassword: true,
      },
    });
    await expectRedirect(active.cookie, "/sau-dang-nhap", "/doi-mat-khau");

    console.log("✓ Slice 0: PENDING, ACTIVE, SUSPENDED và đổi mật khẩu tạm đúng luồng.");
  } finally {
    await db.user.delete({ where: { id: student.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
