// Kết quả sau khi nộp bài: điểm + lịch sử thay đổi đáp án theo từng câu.
export default async function ExamResultPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-600">
        Kết quả đề #{examId}
      </h1>
      {/* TODO: <AnswerHistory /> (features/exams/components) */}
    </section>
  );
}
