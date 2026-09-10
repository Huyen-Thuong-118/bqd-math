import type { ClassSession } from "./types";

export type SessionStatus = "current" | "next";

export function getVietnamNow(date: Date = new Date()): { dayOfWeek: number; minutesOfDay: number } {
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return { dayOfWeek: vn.getUTCDay(), minutesOfDay: vn.getUTCHours() * 60 + vn.getUTCMinutes() };
}

function parseHHMM(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

const WEEK_MINUTES = 7 * 24 * 60;

export function computeSessionStatuses(
  sessions: ClassSession[],
  now: { dayOfWeek: number; minutesOfDay: number } = getVietnamNow(),
): Map<string, SessionStatus> {
  const nowWeekMinutes = now.dayOfWeek * 1440 + now.minutesOfDay;
  const statuses = new Map<string, SessionStatus>();
  let minUpcomingDelta = Infinity;
  const upcoming: { id: string; delta: number }[] = [];

  for (const session of sessions) {
    const startWeekMinutes = session.dayOfWeek * 1440 + parseHHMM(session.startTime);
    const endWeekMinutes = session.dayOfWeek * 1440 + parseHHMM(session.endTime);
    if (startWeekMinutes <= nowWeekMinutes && nowWeekMinutes < endWeekMinutes) {
      statuses.set(session.id, "current");
      continue;
    }
    let delta = startWeekMinutes - nowWeekMinutes;
    if (delta <= 0) delta += WEEK_MINUTES;
    upcoming.push({ id: session.id, delta });
    if (delta < minUpcomingDelta) minUpcomingDelta = delta;
  }
  for (const item of upcoming) {
    if (item.delta === minUpcomingDelta) statuses.set(item.id, "next");
  }
  return statuses;
}
