import { HeroSection } from "@/features/home/components/HeroSection";
import { ScheduleSection } from "@/features/home/components/ScheduleSection";

// Trang chủ — câu truyền cảm hứng + lịch dạy của giáo viên (lớp cơ bản + nâng cao).
// Theo ARCHITECTURE.md: file này chỉ ráp route, toàn bộ UI/dữ liệu nằm ở features/home.
// TODO: khi có dữ liệu thật, fetch ở đây (features/home/queries.ts) rồi truyền xuống ScheduleSection.
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ScheduleSection />
    </>
  );
}
