-- Corrective migration: preserve existing OTP rows while introducing attempt
-- limits and one-use reset grants. Existing pre-deploy OTP hashes are invalid
-- under the new HMAC scheme and naturally require a fresh resend.
ALTER TABLE "PasswordResetOtp"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PasswordResetGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetGrant_challengeId_key" ON "PasswordResetGrant"("challengeId");
CREATE UNIQUE INDEX "PasswordResetGrant_tokenHash_key" ON "PasswordResetGrant"("tokenHash");
CREATE INDEX "PasswordResetGrant_userId_expiresAt_idx" ON "PasswordResetGrant"("userId", "expiresAt");

ALTER TABLE "PasswordResetGrant"
ADD CONSTRAINT "PasswordResetGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasswordResetGrant"
ADD CONSTRAINT "PasswordResetGrant_challengeId_fkey"
FOREIGN KEY ("challengeId") REFERENCES "PasswordResetOtp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
