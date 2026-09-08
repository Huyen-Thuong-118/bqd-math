import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

import { generateOtp, verifyOtpHash } from "./lib/otp";
import {
  generateResetGrantToken,
  hashResetGrantToken,
  isResetGrantToken,
} from "./lib/reset-token";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const OTP_RATE_LIMIT_MAX = 3;
const OTP_MAX_ATTEMPTS = 5;
const RESET_GRANT_TTL_MS = 10 * 60 * 1000;

async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
  );
}

/**
 * Creates a new OTP challenge while serializing requests for one account.
 * A resend consumes every earlier unconsumed challenge and reset grant.
 */
export async function issuePasswordResetOtp(userId: string): Promise<string | null> {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);

    const now = new Date();
    const recentCount = await tx.passwordResetOtp.count({
      where: {
        userId,
        createdAt: { gte: new Date(now.getTime() - OTP_RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentCount >= OTP_RATE_LIMIT_MAX) return null;

    await tx.passwordResetOtp.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.passwordResetGrant.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: now },
    });

    const otp = generateOtp();
    await tx.passwordResetOtp.create({
      data: {
        userId,
        codeHash: verifyOtpHash.hash(userId, otp),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      },
    });
    return otp;
  });
}

/**
 * Verifies and consumes exactly one OTP challenge. The returned grant is a
 * high-entropy bearer token; only its hash is persisted.
 */
export async function verifyPasswordResetOtp(
  userId: string,
  otp: string,
): Promise<string | null> {
  if (!/^\d{6}$/.test(otp)) return null;

  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const now = new Date();
    const challenge = await tx.passwordResetOtp.findFirst({
      where: {
        userId,
        consumedAt: null,
        expiresAt: { gt: now },
        attemptCount: { lt: OTP_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) return null;

    if (!verifyOtpHash.matches(userId, otp, challenge.codeHash)) {
      const nextAttemptCount = challenge.attemptCount + 1;
      await tx.passwordResetOtp.update({
        where: { id: challenge.id },
        data: {
          attemptCount: { increment: 1 },
          ...(nextAttemptCount >= OTP_MAX_ATTEMPTS ? { consumedAt: now } : {}),
        },
      });
      return null;
    }

    const consumed = await tx.passwordResetOtp.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attemptCount: { lt: OTP_MAX_ATTEMPTS },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return null;

    const resetToken = generateResetGrantToken();
    await tx.passwordResetGrant.create({
      data: {
        userId,
        challengeId: challenge.id,
        tokenHash: hashResetGrantToken(resetToken),
        expiresAt: new Date(now.getTime() + RESET_GRANT_TTL_MS),
      },
    });
    return resetToken;
  });
}

/** Consumes a reset grant and updates credentials atomically. */
export async function consumePasswordResetGrant(
  resetToken: string,
  passwordHash: string,
): Promise<boolean> {
  if (!isResetGrantToken(resetToken)) return false;

  return db.$transaction(async (tx) => {
    const now = new Date();
    const grant = await tx.passwordResetGrant.findFirst({
      where: {
        tokenHash: hashResetGrantToken(resetToken),
        consumedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true, userId: true },
    });
    if (!grant) return false;

    const consumed = await tx.passwordResetGrant.updateMany({
      where: { id: grant.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return false;

    await tx.user.update({
      where: { id: grant.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        credentialVersion: { increment: 1 },
      },
    });
    return true;
  });
}
