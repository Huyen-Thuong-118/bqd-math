import { requireActiveAdminId } from "@/features/exams/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
function csv(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export async function GET(_request: Request, { params }: { params: Promise<{ examId: string }> }) {
  try { await requireActiveAdminId(); } catch { return Response.json({ error: "Không có quyền." }, { status: 403 }); }
  const { examId } = await params;
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { title: true, attempts: { where: { submittedAt: { not: null } }, select: { id: true, score: true, correctCount: true, incorrectCount: true, unansweredCount: true, startedAt: true, submittedAt: true, user: { select: { name: true, email: true } } }, orderBy: { submittedAt: "desc" } } } });
  if (!exam) return Response.json({ error: "Không tìm thấy đề." }, { status: 404 });
  const rows = [["Học sinh","Email","Điểm","Đúng","Sai","Bỏ trống","Bắt đầu","Nộp bài"], ...exam.attempts.map((a) => [a.user.name,a.user.email,a.score,a.correctCount,a.incorrectCount,a.unansweredCount,a.startedAt.toISOString(),a.submittedAt?.toISOString() ?? ""])];
  const body = "\uFEFF" + rows.map((row) => row.map(csv).join(",")).join("\r\n");
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=\"ket-qua-${examId}.csv\"`, "Cache-Control": "private, no-store" } });
}
