# features/review-questions

Module "Câu hỏi ôn tập" — chia theo chương, có lời giải chữ hoặc video.

**Sẽ chứa:**
- `queries.ts` — lấy câu hỏi theo chương, tìm kiếm theo từ khóa
- `components/`
  - `QuestionCard.tsx`
  - `SolutionToggle.tsx` — toggle Chữ/Video, video "sáng lên" nếu đã có,
    ngược lại hiện "GV chưa làm video"
  - `ChapterFilter.tsx`
- `types.ts`

**Liên quan:** `prisma/schema.prisma` model `Chapter`, `ReviewQuestion`.
