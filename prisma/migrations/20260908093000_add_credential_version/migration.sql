-- Corrective additive migration. Existing sessions carry no credentialVersion
-- claim and are intentionally required to sign in again after this deploy.
ALTER TABLE "User"
ADD COLUMN "credentialVersion" INTEGER NOT NULL DEFAULT 1;
