import { auth } from "@/auth";
import { hasCurrentCredentialVersion } from "@/features/auth/lib/credential-version";
import { db } from "@/lib/db";
import { getSignedDocumentUrl, isCloudStorageConfigured, readDocument } from "@/lib/storage";

export const dynamic = "force-dynamic";

function error(message: string, status: number) { return Response.json({ error: message }, { status }); }
function asciiFilename(name: string) { return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "tai-lieu"; }

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string; kind: string }> }) {
  const session = await auth();
  if (!session?.user.id) return error("Bạn chưa đăng nhập.", 401);
  const { documentId, kind } = await params;
  if (kind !== "file" && kind !== "answer") return error("Loại file không hợp lệ.", 404);
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true, status: true, credentialVersion: true } });
  if (!user || user.status !== "ACTIVE" || !hasCurrentCredentialVersion(session.user.credentialVersion, user.credentialVersion)) return error("Tài khoản không có quyền truy cập.", 403);
  const document = await db.document.findUnique({
    where: { id: documentId },
    select: { fileUrl: true, fileName: true, contentType: true, answerUrl: true, showAnswer: true, allowDownload: true, classLinks: { where: { class: { enrollments: { some: { studentId: session.user.id } } } }, select: { id: true }, take: 1 } },
  });
  if (!document) return error("Không tìm thấy tài liệu.", 404);
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && (user.role !== "STUDENT" || document.classLinks.length === 0)) return error("Bạn không được giao tài liệu này.", 403);
  if (kind === "answer" && (!document.answerUrl || (!isAdmin && !document.showAnswer))) return error("Đáp án chưa được công bố.", 403);
  const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
  if (wantsDownload && !isAdmin && !document.allowDownload) return error("Giáo viên không cho phép tải file.", 403);
  const key = kind === "answer" ? document.answerUrl : document.fileUrl;
  if (!key) return error("File không tồn tại.", 404);
  const filename = asciiFilename(kind === "answer" ? `dap-an-${document.fileName}` : document.fileName);
  const disposition = `${wantsDownload ? "attachment" : "inline"}; filename=\"${filename}\"`;
  try {
    if (isCloudStorageConfigured()) return Response.redirect(await getSignedDocumentUrl(key, 300, disposition));
    const bytes = await readDocument(key);
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": kind === "answer" ? "application/pdf" : document.contentType, "Content-Disposition": disposition, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (cause) { console.error("Không thể đọc tài liệu:", cause); return error("Không thể đọc file.", 404); }
}
