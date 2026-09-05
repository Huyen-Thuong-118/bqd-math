import {
  saveAnswerBatchForUser,
  validateAnswerBatch,
} from "@/features/exams/repository";
import { ExamAccessError, requireActiveStudentId } from "@/features/exams/access";

// Route MỎNG — chỉ nhận batch, gọi xuống features/exams/actions.ts.
// URL: POST /api/exams/attempts/{attemptId}/answers
export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const userId = await requireActiveStudentId();
    const { attemptId } = await params;
    const body: unknown = await request.json();

    if (!validateAnswerBatch(body)) {
      return Response.json(
        { success: false, error: "Dữ liệu đáp án không hợp lệ." },
        { status: 400 },
      );
    }
    if (body.attemptId !== attemptId) {
      return Response.json(
        { success: false, error: "attemptId không khớp." },
        { status: 400 },
      );
    }

    const result = await saveAnswerBatchForUser(userId, body);
    return Response.json({ success: true, saved: result.count });
  } catch (error) {
    if (error instanceof ExamAccessError) {
      return Response.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    console.error("Autosave đáp án thất bại:", error);
    return Response.json(
      { success: false, error: "Không thể lưu đáp án." },
      { status: 500 },
    );
  }
}
