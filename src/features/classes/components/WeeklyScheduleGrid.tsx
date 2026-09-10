import { DayScheduleCard } from "@/features/home/components/DayScheduleCard";
import type { SessionStatus } from "@/features/home/schedule-status";
import type { DaySchedule } from "@/features/home/types";

export function WeeklyScheduleGrid({ schedule, statusMap }: { schedule: DaySchedule[]; statusMap?: Map<string, SessionStatus> }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {schedule.map((day, index) => (
        <DayScheduleCard key={day.dayOfWeek} day={day} index={index} statusMap={statusMap} />
      ))}
    </div>
  );
}
