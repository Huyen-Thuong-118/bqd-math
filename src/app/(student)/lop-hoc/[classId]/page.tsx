// Chi tiết 1 lớp: danh sách tài liệu xếp theo thời gian TẠO
// (không theo thời gian cập nhật) + ghi chú "Cập nhật lần thứ X".
export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-600">Lớp #{classId}</h1>
      {/* TODO: features/classes → getClassDocuments(classId) */}
    </section>
  );
}
