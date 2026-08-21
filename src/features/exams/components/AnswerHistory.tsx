"use client";

import type { AnswerChange } from "../types";

/**
 * Hiện lịch sử đổi đáp án ngay dưới câu hỏi — sort theo STT câu hỏi rồi
 * theo thời gian đổi (theo đúng yêu cầu). Nhận `history` từ hook
 * useAnswerBuffer, không tự gọi API — luôn hiển thị NGAY LẬP TỨC dù dữ
 * liệu chưa kịp lưu xuống server (xem hooks/useAnswerBuffer.ts).
 */
export function AnswerHistory({
  history,
  questionNumber,
}: {
  history: AnswerChange[];
  questionNumber: number;
}) {
  const entriesForQuestion = history
    .filter((h) => h.questionNumber === questionNumber)
    .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

  if (entriesForQuestion.length <= 1) return null; // chưa đổi lần nào thì không cần hiện

  return (
    <ul className="mt-2 space-y-1 text-xs text-navy-300">
      {entriesForQuestion.map((entry, i) => (
        <li key={i}>
          Đổi thành <span className="font-semibold text-navy-500">{entry.selectedAnswer}</span>{" "}
          lúc {new Date(entry.changedAt).toLocaleTimeString("vi-VN")}
        </li>
      ))}
    </ul>
  );
}
