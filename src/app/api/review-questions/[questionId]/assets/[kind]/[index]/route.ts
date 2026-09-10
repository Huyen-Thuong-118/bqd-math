import { auth } from "@/auth";
import { db } from "@/lib/db";
import { readDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ questionId: string; kind: string; index: string }>;
  },
) {
  const session = await auth();
  if (!session?.user.id) return error("Bạn chưa đăng nhập.", 401);
  const { questionId, kind, index: rawIndex } = await params;
  if (kind !== "question" && kind !== "solution") {
    return error("Loại hình không hợp lệ.", 404);
  }
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0 || index > 19) {
    return error("Số thứ tự hình không hợp lệ.", 404);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return error("Không có quyền.", 403);
  const question = await db.reviewQuestion.findUnique({
    where: { id: questionId },
    select: {
      showSolution: true,
      questionImageKeys: true,
      solutionImageKeys: true,
      classLinks: {
        where: { class: { enrollments: { some: { studentId: session.user.id } } } },
        select: { id: true },
        take: 1,
      },
      attempts: {
        where: { userId: session.user.id },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!question) return error("Không tìm thấy câu hỏi.", 404);
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && (user.role !== "STUDENT" || !question.classLinks.length)) {
    return error("Bạn không được giao câu hỏi này.", 403);
  }
  if (
    kind === "solution" &&
    !isAdmin &&
    (!question.showSolution || !question.attempts.length)
  ) {
    return error("Lời giải chưa được mở.", 403);
  }
  const keys = jsonStringArray(
    kind === "question" ? question.questionImageKeys : question.solutionImageKeys,
  );
  const key = keys[index];
  if (!key || !key.startsWith(`review-questions/${questionId}/${kind}-`)) {
    return error("Không tìm thấy hình.", 404);
  }
  try {
    const bytes = await readDocument(key);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    console.error("Không đọc được hình câu hỏi:", cause);
    return error("Không thể tải hình.", 404);
  }
}

