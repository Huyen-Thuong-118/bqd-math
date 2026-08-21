# app/api/

API routes MỎNG — chỉ nhận request, gọi hàm trong `features/<module>/actions.ts`
hoặc `queries.ts`, rồi trả response. Không viết business logic trực tiếp ở đây.

Ví dụ:
```ts
// app/api/exams/[examId]/submit/route.ts
import { submitExam } from "@/features/exams/actions";

export async function POST(req: Request) {
  const body = await req.json();
  const result = await submitExam(body);
  return Response.json(result);
}
```
