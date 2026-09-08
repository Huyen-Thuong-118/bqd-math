import {
  getLatestAnswers,
  saveAnswerBatchForUser,
  validateAnswerBatch,
} from "@/features/exams/repository";
import { ExamAccessError, requireActiveStudentId } from "@/features/exams/access";
import { db } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const userId = await requireActiveStudentId(); const { attemptId } = await params;
    const owned = await db.examAttempt.findFirst({ where: { id: attemptId, userId }, select: { id: true } });
    if (!owned) return Response.json({ error: "Không tìm thấy lượt làm." }, { status: 404 });
    return Response.json({ answers: Object.fromEntries(await getLatestAnswers(attemptId)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { if (error instanceof ExamAccessError) return Response.json({ error: error.message }, { status: error.status }); return Response.json({ error: "Không thể đồng bộ đáp án." }, { status: 500 }); }
}

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
    return Response.json({
      success: true,
      saved: result.count,
      acknowledgedEventIds: result.acknowledgedEventIds,
    });
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
