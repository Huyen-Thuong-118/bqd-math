import { DAY_LABEL, type ClassSession, type DaySchedule } from "./types";

/**
 * Dữ liệu lịch giảng dạy — hiện là MOCK để dựng UI.
 *
 * TODO: thay bằng truy vấn thật, ví dụ trong features/home/queries.ts:
 *   const sessions = await prisma.teachingSchedule.findMany({
 *     orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
 *   });
 * Field ở đây đã đặt trùng tên với model TeachingSchedule nên chỉ cần
 * đổi nguồn data, `groupByDay()` và các component giữ nguyên.
 */
const scheduleMock: ClassSession[] = [
  {
    id: "1",
    className: "Toán 12 — Cơ bản",
    dayOfWeek: 1, // Thứ 2
    startTime: "18:00",
    endTime: "20:00",
    level: "BASIC",
    mode: "Trực tiếp",
  },
  {
    id: "2",
    className: "Toán 12 — Nâng cao",
    dayOfWeek: 3, // Thứ 4
    startTime: "19:00",
    endTime: "21:00",
    level: "ADVANCED",
    mode: "Trực tiếp",
  },
  {
    id: "3",
    className: "Toán 11 — Cơ bản",
    dayOfWeek: 5, // Thứ 6
    startTime: "18:30",
    endTime: "20:30",
    level: "BASIC",
    mode: "Online",
  },
  {
    id: "4",
    className: "Toán 12 — Cơ bản",
    dayOfWeek: 6, // Thứ 7
    startTime: "08:00",
    endTime: "10:00",
    level: "BASIC",
    mode: "Trực tiếp",
  },
  {
    id: "5",
    className: "Luyện đề — Nâng cao",
    dayOfWeek: 6, // Thứ 7
    startTime: "14:00",
    endTime: "16:00",
    level: "ADVANCED",
    mode: "Online",
  },
];

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

/** Lịch đủ 7 ngày trong tuần, dùng trực tiếp cho ScheduleSection. */
export const weeklySchedule: DaySchedule[] = groupByDay(scheduleMock);
