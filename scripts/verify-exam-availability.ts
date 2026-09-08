import {
  availabilityLabel,
  canReadExam,
  canStartExam,
  canWriteAnswers,
  effectiveAttemptExpiresAt,
  formatVietnamDateTimeInput,
  parseVietnamDateTime,
} from "../src/features/exams/availability";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function main() {
  const openAt = new Date("2026-09-09T01:00:00.000Z");
  const closeAt = new Date("2026-09-09T03:00:00.000Z");
  const base = {
    status: "PUBLISHED" as const,
    mode: "MOCK" as const,
    isForever: false,
    availableFrom: openAt,
    availableTo: closeAt,
    durationMinutes: 90,
  };
  assert(!canStartExam(base, new Date("2026-09-09T00:59:59.000Z")), "Không được start trước giờ mở.");
  assert(canStartExam(base, openAt), "Phải start đúng thời điểm mở.");
  assert(canReadExam(base, new Date("2026-09-09T02:59:59.000Z")), "Phải đọc đề trước giờ đóng.");
  assert(!canReadExam(base, new Date("2026-09-09T03:00:01.000Z")), "Không được đọc đề sau giờ đóng.");
  assert(!canWriteAnswers(base, closeAt, closeAt), "Không được autosave ở deadline.");
  assert(
    effectiveAttemptExpiresAt(base, new Date("2026-09-09T02:00:00.000Z"))?.getTime() === closeAt.getTime(),
    "Deadline effective phải lấy thời điểm sớm hơn giữa duration và thời điểm đóng.",
  );

  const input = "2026-09-09T08:30";
  const instant = parseVietnamDateTime(input);
  assert(
    instant?.toISOString() === "2026-09-09T01:30:00.000Z" && formatVietnamDateTimeInput(instant) === input,
    "Load-save datetime-local phải giữ nguyên instant UTC+7.",
  );
  assert(availabilityLabel(base, openAt).includes("Đến"), "Nhãn availability phải dùng policy chung.");
  console.log("✓ Exam availability và timezone policy đạt.");
}

main();
