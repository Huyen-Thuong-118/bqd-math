import { db } from "@/lib/db";
import type { AnswerBatchPayload } from "./types";

/**
 * Ghi 1 BATCH nhiều lần đổi đáp án trong 1 lần gọi DB (createMany), thay vì
 * ghi từng lần đổi 1 request riêng. Đây là điểm mấu chốt chống nghẽn khi
 * 500 HS thi cùng lúc — xem ARCHITECTURE.md mục "500 người thi cùng lúc".
 *
 * Được gọi từ app/api/exams/[examId]/answers/route.ts, KHÔNG gọi trực
 * tiếp từ component (theo quy ước app/ mỏng, features/ chứa logic thật).
 */
export async function saveAnswerBatch(payload: AnswerBatchPayload) {
  if (payload.changes.length === 0) return { count: 0 };

  const result = await db.answerHistory.createMany({
    data: payload.changes.map((change) => ({
      attemptId: payload.attemptId,
      questionNumber: change.questionNumber,
      selectedAnswer: change.selectedAnswer,
      changedAt: new Date(change.changedAt),
    })),
  });

  return result;
}

/**
 * Lấy toàn bộ lịch sử đổi đáp án của 1 lần làm bài, sort đúng thứ tự yêu
 * cầu: theo STT câu hỏi trước, rồi theo thời gian thay đổi.
 */
export async function getAnswerHistory(attemptId: string) {
  return db.answerHistory.findMany({
    where: { attemptId },
    orderBy: [{ questionNumber: "asc" }, { changedAt: "asc" }],
  });
}

/**
 * Đáp án hiện tại (mới nhất) của từng câu — dùng để render lại trạng thái
 * đã chọn khi HS load lại trang giữa chừng lúc thi.
 */
export async function getLatestAnswers(attemptId: string) {
  const all = await getAnswerHistory(attemptId);
  const latest = new Map<number, string>();
  for (const entry of all) {
    latest.set(entry.questionNumber, entry.selectedAnswer); // ghi đè -> giữ lần cuối vì đã sort tăng dần theo thời gian
  }
  return latest;
}
