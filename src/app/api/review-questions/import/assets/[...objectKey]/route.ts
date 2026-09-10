import {
  readReviewImportSnapshot,
  ReviewQuestionImportError,
} from "@/features/review-questions/importer";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ objectKey: string[] }> },
) {
  try {
    const { objectKey } = await params;
    const asset = await readReviewImportSnapshot(objectKey);
    return new Response(Buffer.from(asset.bytes), {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ReviewQuestionImportError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Không thể trả ảnh câu hỏi import:", error);
    return Response.json({ error: "Không thể tải ảnh câu hỏi." }, { status: 500 });
  }
}

