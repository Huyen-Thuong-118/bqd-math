// Danh sách lớp học của HS đang đăng nhập (HS chỉ thấy lớp mình được assign).
export default function ClassListPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-600">Lớp học của tôi</h1>
      {/* TODO: gọi features/classes → getClassesForCurrentUser() */}
    </section>
  );
}