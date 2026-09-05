import { HeroSection } from "@/features/home/components/HeroSection";
import { ScheduleSection } from "@/features/home/components/ScheduleSection";
import { getPublicWeeklySchedule } from "@/features/classes/schedule-queries";

// Trang chủ — câu truyền cảm hứng + lịch dạy của giáo viên (lớp cơ bản + nâng cao).
// Theo docs/architecture.md: file này chỉ ráp route, UI/dữ liệu nằm ở features/home.
// TODO: khi có dữ liệu thật, fetch ở đây (features/home/queries.ts) rồi truyền xuống ScheduleSection.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { schedule } = await getPublicWeeklySchedule();
  return (
    <>
      <HeroSection />
      <ScheduleSection schedule={schedule} />
    </>
  );
}
