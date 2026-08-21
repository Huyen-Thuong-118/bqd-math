import { saveAnswerBatch } from "@/features/exams/actions";
import type { AnswerBatchPayload } from "@/features/exams/types";

// Route MỎNG — chỉ nhận batch, gọi xuống features/exams/actions.ts.
// URL: POST /api/exams/attempts/{attemptId}/answers
// TODO: xác thực attemptId thuộc về user hiện tại (session) trước khi ghi.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const body = (await request.json()) as AnswerBatchPayload;

  if (body.attemptId !== attemptId) {
    return Response.json({ success: false, error: "attemptId không khớp" }, { status: 400 });
  }

  const result = await saveAnswerBatch(body);
  return Response.json({ success: true, saved: result.count });
}
