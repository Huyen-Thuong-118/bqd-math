import { randomUUID } from "node:crypto";

export function generateStudentCode() {
  return `HS-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export function normalizeClassCode(value: string) {
  return value.trim().toUpperCase().replaceAll(/\s+/g, "");
}

export function isValidClassCode(value: string) {
  return /^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(value);
}
