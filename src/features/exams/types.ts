export type ExamMode = "MOCK" | "PRACTICE";

/** 1 lần đổi đáp án — đơn vị nhỏ nhất được lưu trong lịch sử. */
export type AnswerChange = {
  questionNumber: number;
  selectedAnswer: string;
  changedAt: string; // ISO string — set ở CLIENT lúc bấm chọn, không phải lúc gửi lên server
};

/** Payload gửi lên API khi flush buffer — gộp nhiều AnswerChange trong 1 request. */
export type AnswerBatchPayload = {
  attemptId: string;
  changes: AnswerChange[];
};
