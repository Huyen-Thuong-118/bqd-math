import {
  importReviewQuestionPdf,
  ReviewQuestionImportError,
} from "@/features/review-questions/importer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 21 * 1024 * 1024) {
      return Response.json(
        { error: "File PDF không được vượt quá 20 MB." },
        { status: 413 },
      );
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Hãy chọn file PDF." }, { status: 400 });
    }
    const result = await importReviewQuestionPdf(file);
    return Response.json({ success: true, data: result }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ReviewQuestionImportError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Import câu hỏi ôn tập thất bại:", error);
    return Response.json(
      { error: "Không thể đọc file PDF lúc này." },
      { status: 500 },
    );
  }
}

