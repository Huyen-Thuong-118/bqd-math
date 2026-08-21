// Trang chủ — hiện lịch dạy của giáo viên (lớp cơ bản + nâng cao).
// Dữ liệu lịch dạy: TODO lấy từ prisma.teachingSchedule.findMany()
export default function HomePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-600">
        Lịch dạy của giáo viên
      </h1>
      <p className="text-navy-400">
        {/* TODO: render TeachingCalendar (features/classes/components) */}
        Lịch lớp Cơ bản & Nâng cao sẽ hiển thị ở đây.
      </p>
    </section>
  );
}
