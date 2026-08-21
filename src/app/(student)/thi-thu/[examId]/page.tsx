// Giao diện làm bài: phiếu tô đáp án + đồng hồ đếm ngược (nếu là "thi thử")
// hoặc không đếm giờ (nếu là "luyện tập") — cùng 1 UI, khác chế độ.
export default async function ExamTakingPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-600">Đề #{examId}</h1>
      {/* TODO: <PdfViewer /> + <AnswerSheet /> + <ExamTimer /> (features/exams/components) */}
    </section>
  );
}