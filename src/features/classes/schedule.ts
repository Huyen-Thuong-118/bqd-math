export type ClassScheduleSlotInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export const WEEK_DAYS = [
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
  { value: 0, label: "Chủ nhật" },
] as const;

export function formatScheduleSlot(slot: ClassScheduleSlotInput) {
  const day = WEEK_DAYS.find((item) => item.value === slot.dayOfWeek)?.label ?? "Ngày khác";
  return `${day}, ${slot.startTime}–${slot.endTime}`;
}

export function formatClassSchedule(
  slots: ClassScheduleSlotInput[],
  legacySchedule = "",
) {
  const orderedSlots = [...slots].sort((left, right) => {
    const leftDay = left.dayOfWeek === 0 ? 7 : left.dayOfWeek;
    const rightDay = right.dayOfWeek === 0 ? 7 : right.dayOfWeek;
    return leftDay - rightDay || left.startTime.localeCompare(right.startTime);
  });
  return orderedSlots.length ? orderedSlots.map(formatScheduleSlot).join(" · ") : legacySchedule || "Chưa xếp lịch";
}
