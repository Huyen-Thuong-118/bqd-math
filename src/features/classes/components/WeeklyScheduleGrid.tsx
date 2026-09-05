import { DayScheduleCard } from "@/features/home/components/DayScheduleCard";
import type { DaySchedule } from "@/features/home/types";

export function WeeklyScheduleGrid({ schedule }: { schedule: DaySchedule[] }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {schedule.map((day, index) => (
        <DayScheduleCard key={day.dayOfWeek} day={day} index={index} />
      ))}
    </div>
  );
}
