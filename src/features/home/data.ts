import { DAY_LABEL, type ClassSession, type DaySchedule } from "./types";

/** Thứ tự hiển thị trong tuần: Thứ 2 → Chủ nhật.
 *  dayOfWeek 0 = Chủ nhật nhưng phải đứng CUỐI khi hiển thị, đúng thói quen
 *  đọc lịch của người Việt. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Gom danh sách buổi học phẳng thành từng ngày để render mỗi ngày 1 card.
 *
 * Trả về ĐỦ CẢ 7 NGÀY, kể cả ngày không có lớp (khi đó `sessions` là mảng
 * rỗng và card hiển thị trạng thái "Chưa có lịch học"). Nhờ vậy lịch tuần
 * luôn đủ 7 ô, học sinh nhìn ra ngay ngày nào nghỉ thay vì phải tự suy ra
 * từ những ngày bị thiếu.
 */
export function groupByDay(sessions: ClassSession[]): DaySchedule[] {
  const byDay = new Map<number, ClassSession[]>();

  for (const session of sessions) {
    const existing = byDay.get(session.dayOfWeek);
    if (existing) existing.push(session);
    else byDay.set(session.dayOfWeek, [session]);
  }

  return WEEK_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    day: DAY_LABEL[dayOfWeek],
    sessions: [...(byDay.get(dayOfWeek) ?? [])].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    ),
  }));
}
