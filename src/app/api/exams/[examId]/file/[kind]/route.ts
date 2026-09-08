import { auth } from "@/auth";
import { hasCurrentCredentialVersion } from "@/features/auth/lib/credential-version";
import { getSolutionVisibility } from "@/features/exams/solution-visibility";
import { db } from "@/lib/db";
import { readDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ examId: string; kind: string }> },
) {
  const session = await auth();
  if (!session?.user.id) return errorResponse("Bạn chưa đăng nhập.", 401);

  const { examId, kind } = await params;
  if (kind !== "exam" && kind !== "solution") {
    return errorResponse("Loại tài liệu không hợp lệ.", 404);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, status: true, credentialVersion: true },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !hasCurrentCredentialVersion(session.user.credentialVersion, user.credentialVersion)
  ) {
    return errorResponse("Tài khoản không có quyền truy cập.", 403);
  }

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      title: true,
      status: true,
      examFileUrl: true,
      answerFileUrl: true,
      showAnswer: true,
      hideWrongAnswers: true,
      allowDownload: true,
      examLinks: {
        where: { class: { enrollments: { some: { studentId: session.user.id } } } },
        select: { id: true },
        take: 1,
      },
      attempts: {
        where: { userId: session.user.id, submittedAt: { not: null } },
        select: { id: true, finalizedAnswers: { select: { isCorrect: true } } },
        take: 1,
      },
    },
  });
  if (!exam) return errorResponse("Không tìm thấy đề thi.", 404);

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && (user.role !== "STUDENT" || exam.examLinks.length === 0)) {
    return errorResponse("Bạn không có quyền xem đề này.", 403);
  }
  if (!isAdmin && exam.status === "DRAFT") {
    return errorResponse("Đề chưa được xuất bản.", 403);
  }

  const submittedAttempt = exam.attempts[0];
  const solutionVisibility = getSolutionVisibility({
    isAdmin,
    submitted: Boolean(submittedAttempt),
    showAnswer: exam.showAnswer,
    hideWrongAnswers: exam.hideWrongAnswers,
    allAnswersCorrect:
      Boolean(submittedAttempt?.finalizedAnswers.length) &&
      submittedAttempt?.finalizedAnswers.every((answer) => answer.isCorrect === true),
  });
  if (kind === "solution" && (!exam.answerFileUrl || !solutionVisibility.solutionFile)) {
    return errorResponse("Lời giải chưa được mở.", 403);
  }

  const url = new URL(request.url);
  const wantsDownload = url.searchParams.get("download") === "1";
  if (wantsDownload && !isAdmin && !exam.allowDownload) {
    return errorResponse("Giáo viên không cho phép tải file này.", 403);
  }

  const key = kind === "exam" ? exam.examFileUrl : exam.answerFileUrl;
  if (!key) return errorResponse("File không tồn tại.", 404);

  try {
    const bytes = await readDocument(key);
    const asciiName = kind === "exam" ? "de-thi.pdf" : "loi-giai.pdf";
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${wantsDownload ? "attachment" : "inline"}; filename="${asciiName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Không thể đọc file đề thi:", error);
    return errorResponse("Không thể đọc file.", 404);
  }
}
