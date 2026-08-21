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

/**
 * Gom danh sách buổi học phẳng thành từng ngày để render mỗi ngày 1 card.
 * Chỉ trả về ngày CÓ lớp (yêu cầu: không hiện ngày trống), sắp xếp từ
 * Thứ 2 → Chủ nhật cho đúng thói quen đọc lịch của người Việt.
 */
export function groupByDay(sessions: ClassSession[]): DaySchedule[] {
  const byDay = new Map<number, ClassSession[]>();

  for (const session of sessions) {
    const existing = byDay.get(session.dayOfWeek);
    if (existing) existing.push(session);
    else byDay.set(session.dayOfWeek, [session]);
  }

  // dayOfWeek 0 = Chủ nhật nhưng phải đứng CUỐI tuần khi hiển thị
  const weekOrder = (day: number) => (day === 0 ? 7 : day);

  return [...byDay.entries()]
    .sort(([a], [b]) => weekOrder(a) - weekOrder(b))
    .map(([dayOfWeek, daySessions]) => ({
      dayOfWeek,
      day: DAY_LABEL[dayOfWeek],
      sessions: [...daySessions].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      ),
    }));
}

/** Lịch đã gom theo ngày, dùng trực tiếp cho ScheduleSection. */
export const weeklySchedule: DaySchedule[] = groupByDay(scheduleMock);
