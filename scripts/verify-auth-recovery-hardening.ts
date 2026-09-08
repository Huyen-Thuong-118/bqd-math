import "dotenv/config";

import { randomInt, randomUUID } from "node:crypto";

import {
  consumePasswordResetGrant,
  issuePasswordResetOtp,
  verifyPasswordResetOtp,
} from "../src/features/auth/password-recovery";
import { verifyOtpHash } from "../src/features/auth/lib/otp";
import {
  generateResetGrantToken,
  hashResetGrantToken,
} from "../src/features/auth/lib/reset-token";
import { db } from "../src/lib/db";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { requireTestDatabase } from "./test-database-guard";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createStudent(label: string) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  return db.user.create({
    data: {
      name: `Recovery ${label}`,
      email: `recovery-${label}-${suffix}@verify.test`,
      studentPhone: `01${randomInt(10_000_000, 100_000_000)}`,
      parentPhone: `02${randomInt(10_000_000, 100_000_000)}`,
      passwordHash: await hashPassword("InitialPassword123!"),
      role: "STUDENT",
      status: "ACTIVE",
    },
  });
}

async function main() {
  requireTestDatabase();
  if (!process.env.PASSWORD_RESET_OTP_SECRET) {
    throw new Error("PASSWORD_RESET_OTP_SECRET phải được cấu hình cho verification này.");
  }

  const users = await Promise.all([
    createStudent("resend"),
    createStudent("attempts"),
    createStudent("concurrent"),
    createStudent("expired"),
  ]);

  try {
    const firstOtp = await issuePasswordResetOtp(users[0].id);
    const resentOtp = await issuePasswordResetOtp(users[0].id);
    assert(firstOtp && resentOtp && firstOtp !== resentOtp, "Resend phải sinh OTP mới.");
    assert(
      (await verifyPasswordResetOtp(users[0].id, firstOtp)) === null,
      "OTP cũ phải bị vô hiệu ngay khi resend.",
    );
    assert(
      Boolean(await verifyPasswordResetOtp(users[0].id, resentOtp)),
      "OTP mới hợp lệ phải sinh reset grant.",
    );

    const protectedOtp = await issuePasswordResetOtp(users[1].id);
    assert(protectedOtp, "Không tạo được OTP test attempt limit.");
    const incorrectOtp = protectedOtp === "000000" ? "999999" : "000000";
    for (let index = 0; index < 5; index += 1) {
      assert(
        (await verifyPasswordResetOtp(users[1].id, incorrectOtp)) === null,
        "OTP sai phải luôn bị từ chối.",
      );
    }
    assert(
      (await verifyPasswordResetOtp(users[1].id, protectedOtp)) === null,
      "OTP đúng sau ngưỡng sai phải bị khóa.",
    );

    const concurrentOtp = await issuePasswordResetOtp(users[2].id);
    assert(concurrentOtp, "Không tạo được OTP concurrent.");
    const concurrent = await Promise.all([
      verifyPasswordResetOtp(users[2].id, concurrentOtp),
      verifyPasswordResetOtp(users[2].id, concurrentOtp),
    ]);
    const grant = concurrent.find((token): token is string => Boolean(token));
    assert(
      concurrent.filter(Boolean).length === 1 && grant,
      "Hai verify đồng thời chỉ được cấp đúng một reset grant.",
    );
    const changedHash = await hashPassword("ChangedPassword456!");
    assert(
      await consumePasswordResetGrant(grant, changedHash),
      "Reset grant hợp lệ phải đổi password một lần.",
    );
    assert(
      !(await consumePasswordResetGrant(grant, await hashPassword("ReplayPassword789!"))),
      "Reset grant không được replay.",
    );
    const changed = await db.user.findUniqueOrThrow({
      where: { id: users[2].id },
      select: { passwordHash: true, credentialVersion: true },
    });
    assert(
      Boolean(changed.passwordHash) &&
        (await verifyPassword("ChangedPassword456!", changed.passwordHash!)),
      "Password sau reset chưa được lưu đúng.",
    );
    assert(changed.credentialVersion === 2, "Reset password phải tăng credential version.");

    const expiredOtp = "123456";
    const expiredChallenge = await db.passwordResetOtp.create({
      data: {
        userId: users[3].id,
        codeHash: verifyOtpHash.hash(users[3].id, expiredOtp),
        expiresAt: new Date(Date.now() - 1_000),
      },
    });
    assert(
      (await verifyPasswordResetOtp(users[3].id, expiredOtp)) === null,
      "OTP hết hạn phải bị từ chối.",
    );

    const expiredGrant = generateResetGrantToken();
    await db.passwordResetGrant.create({
      data: {
        userId: users[3].id,
        challengeId: expiredChallenge.id,
        tokenHash: hashResetGrantToken(expiredGrant),
        expiresAt: new Date(Date.now() - 1_000),
      },
    });
    assert(
      !(await consumePasswordResetGrant(expiredGrant, await hashPassword("ExpiredPassword123!"))),
      "Reset grant hết hạn phải bị từ chối.",
    );

    console.log("✓ Password recovery: resend, attempt limit, expiry, concurrency và replay đều đạt.");
  } finally {
    await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
    await db.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
});
