import { getHomeScheduleView } from "@/features/classes/schedule-queries";
import { ExamCountdown } from "@/features/home/components/ExamCountdown";
import { HeroSection } from "@/features/home/components/HeroSection";
import { ScheduleSection } from "@/features/home/components/ScheduleSection";
import { StudentScheduleSection } from "@/features/home/components/StudentScheduleSection";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const view = await getHomeScheduleView();
  return <><HeroSection /><ExamCountdown />{view.kind === "STUDENT" ? <StudentScheduleSection studentName={view.studentName} schedule={view.schedule} classCount={view.classCount} sessionCount={view.sessionCount} /> : <ScheduleSection schedule={view.schedule} />}</>;
}
