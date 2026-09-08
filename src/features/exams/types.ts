export type ExamMode = "MOCK" | "PRACTICE";
export type ExamQuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";

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

export type ExamListItem = {
  id: string;
  title: string;
  mode: ExamMode;
  durationMinutes: number | null;
  questionCount: number;
  maxAttempts: number | null;
  attemptCount: number;
  bestScore: number | null;
  openAttemptId: string | null;
  available: boolean;
  availabilityLabel: string;
  recentAttempts: { id: string; score: number; submittedAt: string }[];
};

export type TakingQuestion = {
  id: string;
  number: number;
  type: ExamQuestionType;
  content: string;
  options: string[];
  points: number;
};

export type TakingAttempt = {
  id: string;
  examId: string;
  examTitle: string;
  mode: ExamMode;
  startedAt: string;
  expiresAt: string | null;
  hasExamFile: boolean;
  hasAnswerFile: boolean;
  showAnswer: boolean;
  allowDownload: boolean;
  questions: TakingQuestion[];
  initialAnswers: Record<number, string>;
  initialHistory: AnswerChange[];
};

export type ResultQuestion = {
  questionNumber: number;
  content: string;
  options: string[];
  selectedAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
  pointsAwarded: number;
  pointsPossible: number;
  explanation: string | null;
};

export type ExamResult = {
  attemptId: string;
  examId: string;
  examTitle: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  startedAt: string;
  submittedAt: string;
  hasExamFile: boolean;
  hasAnswerFile: boolean;
  showAnswer: boolean;
  canViewSolutionFile: boolean;
  allowDownload: boolean;
  questions: ResultQuestion[];
};
