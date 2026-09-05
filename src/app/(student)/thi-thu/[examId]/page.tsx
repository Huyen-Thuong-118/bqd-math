import { notFound, redirect } from "next/navigation";

import { ExamWorkspace } from "@/features/exams/components/ExamWorkspace";
import { getTakingAttempt } from "@/features/exams/queries";

export const dynamic = "force-dynamic";

export default async function ExamTakingPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ attemptId?: string | string[] }>;
}) {
  const { examId } = await params;
  const query = await searchParams;
  const attemptId =
    typeof query.attemptId === "string" ? query.attemptId : undefined;
  if (!attemptId) redirect("/thi-thu");

  const attempt = await getTakingAttempt(examId, attemptId);
  if (!attempt) notFound();
  if ("submitted" in attempt) {
    redirect(`/thi-thu/${examId}/result?attemptId=${attemptId}`);
  }

  return <ExamWorkspace attempt={attempt} />;
}
