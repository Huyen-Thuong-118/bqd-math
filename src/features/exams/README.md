# features/exams

Module lớn nhất: Đề thi, Phiếu tô đáp án, Phòng thi thử + Luyện tập.

## Đã có

- `types.ts` — `AnswerChange`, `AnswerBatchPayload`
- `actions.ts` — `saveAnswerBatch()` (ghi batch), `getAnswerHistory()`, `getLatestAnswers()`
- `hooks/useAnswerBuffer.ts` — hook chính khi HS làm bài: buffer đáp án ở
  client, gộp gửi lên server mỗi ~2.5s thay vì gửi mỗi lần click (chống
  nghẽn DB khi nhiều HS thi cùng lúc — xem ARCHITECTURE.md)
- `components/AnswerHistory.tsx` — hiện lịch sử đổi đáp án dưới mỗi câu
- API route tương ứng: `app/api/exams/[examId]/answers/route.ts`

## Còn thiếu (TODO)

- `queries.ts` — danh sách đề, điểm đã làm
- `answer-sheet.ts` — logic sinh phiếu tô theo số câu mỗi phần
- `components/PdfViewer.tsx` — hiển thị PDF qua signed URL từ `lib/storage.ts`,
  render bằng PDF.js canvas (không dùng iframe), thêm watermark tên HS
- `components/AnswerSheet.tsx` — ghép `useAnswerBuffer` + UI phiếu tô thật
- `components/ExamTimer.tsx` — đếm ngược tính ở client, chỉ đồng bộ lại
  với server mỗi ~30s (không polling liên tục)
- Xác thực attemptId thuộc về user hiện tại trong API route trước khi ghi
- Logic chấm điểm (`submitExam`) — tách khỏi request nộp bài nếu chấm nặng

**Liên quan:** `prisma/schema.prisma` model `Exam`, `ExamAttempt`, `AnswerHistory`.
`lib/storage.ts` (PDF qua R2), `lib/stream.ts` (video qua Cloudflare Stream).

> Ghi chú: "Thi thử" và "Luyện tập" dùng CHUNG component, chỉ khác 1 prop
> `mode: "mock" | "practice"` quyết định có hiện `ExamTimer` hay không.
