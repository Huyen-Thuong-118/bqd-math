// Danh sách câu hỏi trong 1 chương — mỗi câu có toggle Lời giải chữ / Video.
export default async function ReviewQuestionsPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-navy-600">
        Chương #{chapterId}
      </h1>
      {/* TODO: render QuestionCard list (features/review-questions/components) */}
    </section>
  );
}
