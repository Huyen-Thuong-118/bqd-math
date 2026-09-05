import type { Metadata } from "next";

import { WeeklyScheduleGrid } from "@/features/classes/components/WeeklyScheduleGrid";
import { getStudentWeeklySchedule } from "@/features/classes/schedule-queries";

export const metadata: Metadata = { title: "Lịch học của tôi | BQD Math" };
export const dynamic = "force-dynamic";

export default async function StudentSchedulePage() {
  const { schedule, classCount, sessionCount } = await getStudentWeeklySchedule();
  return (
    <section className="space-y-6">
      <div><h1 className="text-2xl font-semibold text-navy-600">Lịch học của tôi</h1><p className="mt-1 text-sm text-navy-400">Chỉ hiển thị lịch của những lớp em đã được duyệt và xếp vào.</p></div>
      {sessionCount > 0 ? <><div className="flex flex-wrap gap-3 text-sm text-navy-500"><span className="rounded-full bg-pastel-100 px-4 py-2"><strong>{classCount}</strong> lớp</span><span className="rounded-full bg-pastel-100 px-4 py-2"><strong>{sessionCount}</strong> buổi/tuần</span></div><WeeklyScheduleGrid schedule={schedule} /></> : <div className="rounded-3xl border border-dashed border-navy-200 bg-white p-12 text-center text-sm text-navy-400">Em chưa được xếp vào lớp có lịch học.</div>}
    </section>
  );
}
