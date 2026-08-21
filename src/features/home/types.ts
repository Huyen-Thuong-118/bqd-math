/**
 * Type của khối "Lịch giảng dạy" ở Trang chủ.
 *
 * Cố tình đặt sát model `TeachingSchedule` trong prisma/schema.prisma
 * (className, dayOfWeek, startTime, endTime, level) để khi có dữ liệu thật
 * chỉ cần đổi nguồn data, không phải viết lại component.
 */

/** Trùng enum ClassLevel trong prisma/schema.prisma */
export type ClassLevel = "BASIC" | "ADVANCED";

/** Hình thức học — CHƯA có trong schema.
 *  TODO: thêm cột `mode` vào model TeachingSchedule rồi bỏ chú thích này. */
export type ClassMode = "Trực tiếp" | "Online";

export type ClassSession = {
  id: string;
  className: string;
  /** 0 = Chủ nhật ... 6 = Thứ 7 — đúng quy ước của TeachingSchedule.dayOfWeek */
  dayOfWeek: number;
  startTime: string; // "18:00"
  endTime: string; // "20:00"
  level: ClassLevel;
  mode: ClassMode;
};

/** Kết quả sau khi gom các buổi học theo ngày để render mỗi ngày 1 card. */
export type DaySchedule = {
  dayOfWeek: number;
  /** Tên ngày hiển thị: "Thứ 2", "Chủ nhật"... */
  day: string;
  sessions: ClassSession[];
};

/** Nhãn tiếng Việt của trình độ — dùng cho badge trên card. */
export const LEVEL_LABEL: Record<ClassLevel, string> = {
  BASIC: "Cơ bản",
  ADVANCED: "Nâng cao",
};

/** Tên ngày theo index dayOfWeek (0 = CN). */
export const DAY_LABEL = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
] as const;
