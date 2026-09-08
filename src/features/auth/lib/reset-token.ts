import { createHash, randomBytes } from "crypto";

const RESET_GRANT_BYTES = 32;

/** High-entropy token only returned once to the verified browser. */
export function generateResetGrantToken() {
  return randomBytes(RESET_GRANT_BYTES).toString("base64url");
}

/** A random 256-bit token can safely be stored as a one-way SHA-256 hash. */
export function hashResetGrantToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isResetGrantToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
