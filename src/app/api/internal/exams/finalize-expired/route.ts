import { finalizeExpiredAttempts } from "@/features/exams/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "Cron is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await finalizeExpiredAttempts();
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
