import type { Prisma } from "@prisma/client";

async function nextSequenceValue(
  transaction: Prisma.TransactionClient,
  sequence: "student_code_seq" | "class_code_seq",
) {
  const rows = sequence === "student_code_seq"
    ? await transaction.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('student_code_seq') AS value`
    : await transaction.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('class_code_seq') AS value`;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error(`Không thể cấp số từ ${sequence}.`);
  return value.toString();
}

export function nextStudentCode(transaction: Prisma.TransactionClient) {
  return nextSequenceValue(transaction, "student_code_seq");
}

export function nextClassCode(transaction: Prisma.TransactionClient) {
  return nextSequenceValue(transaction, "class_code_seq");
}

export function normalizeClassCode(value: string) {
  return value.trim().toUpperCase().replaceAll(/\s+/g, "");
}

export function isValidClassCode(value: string) {
  return /^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(value);
}
