# features/documents

Module "Tài liệu" — đề thi + tài liệu ôn tập có đáp án, admin tổ chức theo thư mục.

**Sẽ chứa:**
- `queries.ts` — `getDocumentTree()` (cấu trúc thư mục lồng nhau)
- `actions.ts` — upload/di chuyển file giữa các thư mục
- `components/FolderTree.tsx`

**Liên quan:** `prisma/schema.prisma` model `Document`, `Folder`.
