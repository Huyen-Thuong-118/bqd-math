import type { ExamMode, ExamStatus } from "@prisma/client";

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

export type ExamAvailabilityInput = {
  status: ExamStatus;
  mode: ExamMode;
  isForever: boolean;
  availableFrom: Date | null;
  availableTo: Date | null;
  durationMinutes: number | null;
};

export function canStartExam(exam: ExamAvailabilityInput, now = new Date()) {
  if (exam.status !== "PUBLISHED") return false;
  if (exam.isForever) return true;
  return (
    (!exam.availableFrom || exam.availableFrom <= now) &&
    (!exam.availableTo || exam.availableTo > now)
  );
}

export function canReadExam(exam: ExamAvailabilityInput, now = new Date()) {
  return canStartExam(exam, now);
}

export function canWriteAnswers(
  exam: ExamAvailabilityInput,
  expiresAt: Date | null,
  now = new Date(),
) {
  return canReadExam(exam, now) && (!expiresAt || expiresAt > now);
}

/** A final submission is allowed after the assignment closes to preserve work. */
export function canFinalizeExam() {
  return true;
}

export function effectiveAttemptExpiresAt(
  exam: ExamAvailabilityInput,
  startedAt: Date,
) {
  const deadlines: Date[] = [];
  if (exam.mode === "MOCK" && exam.durationMinutes) {
    deadlines.push(new Date(startedAt.getTime() + exam.durationMinutes * 60_000));
  }
  if (!exam.isForever && exam.availableTo) deadlines.push(exam.availableTo);
  if (deadlines.length === 0) return null;
  return new Date(Math.min(...deadlines.map((deadline) => deadline.getTime())));
}

export function availabilityLabel(exam: ExamAvailabilityInput, now = new Date()) {
  if (exam.status === "CLOSED") return "Đã đóng";
  if (exam.status !== "PUBLISHED") return "Chưa xuất bản";
  if (exam.isForever) return "Luôn mở";
  if (exam.availableFrom && exam.availableFrom > now) {
    return `Mở từ ${formatVietnamDateTimeDisplay(exam.availableFrom)}`;
  }
  if (exam.availableTo && exam.availableTo < now) return "Đã đóng";
  return exam.availableTo
    ? `Đến ${formatVietnamDateTimeDisplay(exam.availableTo)}`
    : "Đang mở";
}

function dateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

/** Formats an instant as the value expected by datetime-local in UTC+7. */
export function formatVietnamDateTimeInput(date: Date | null) {
  if (!date) return "";
  const parts = dateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatVietnamDateTimeDisplay(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/** Parses the datetime-local fields as Vietnam time, not the server timezone. */
export function parseVietnamDateTime(value: string): Date | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::00)?$/);
  if (!match) return null;
  const instant = new Date(`${match[1]}:00+07:00`);
  return Number.isNaN(instant.getTime()) || formatVietnamDateTimeInput(instant) !== match[1]
    ? null
    : instant;
}
