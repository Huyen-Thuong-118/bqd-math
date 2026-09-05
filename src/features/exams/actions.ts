"use server";

import { ExamAccessError, requireActiveStudentId } from "./access";
import { startAttemptForUser, submitAttemptForUser } from "./service";

type StartExamResult =
  | { success: true; attemptId: string; submitted: boolean }
  | { success: false; error: string };

type SubmitExamResult =
  | { success: true; attemptId: string }
  | { success: false; error: string };

export async function startExam(examId: string): Promise<StartExamResult> {
  try {
    const userId = await requireActiveStudentId();
    const result = await startAttemptForUser(examId, userId);
    return { success: true, ...result };
  } catch (error) {
    console.error("startExam thất bại:", error);
    return {
      success: false,
      error:
        error instanceof ExamAccessError
          ? error.message
          : "Không thể bắt đầu bài thi, vui lòng thử lại.",
    };
  }
}

export async function submitExam(attemptId: string): Promise<SubmitExamResult> {
  try {
    const userId = await requireActiveStudentId();
    await submitAttemptForUser(attemptId, userId);
    return { success: true, attemptId };
  } catch (error) {
    console.error("submitExam thất bại:", error);
    return {
      success: false,
      error:
        error instanceof ExamAccessError
          ? error.message
          : "Không thể nộp bài, vui lòng thử lại.",
    };
  }
}
