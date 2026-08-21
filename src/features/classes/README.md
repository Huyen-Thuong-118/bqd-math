# features/classes

Module "Lớp học": giáo viên quản lý nhiều lớp, HS chỉ vào được lớp mình.

**Sẽ chứa:**
- `queries.ts` — `getClassesForUser()`, `getClassDocuments(classId)`
- `actions.ts` — tạo lớp, thêm/xoá HS khỏi lớp, upload tài liệu vào lớp
- `components/` — `ClassCard.tsx`, `DocumentList.tsx` (sort theo ngày TẠO, hiện "Cập nhật lần thứ X")
- `types.ts`

**Liên quan:** `prisma/schema.prisma` model `Class`, `Document`.
