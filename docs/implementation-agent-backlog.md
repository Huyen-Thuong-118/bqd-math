# Implementation backlog cho agent

Tài liệu này chuyển backlog UI thành các task kỹ thuật có thể giao độc lập cho
agent. Mỗi task phải được triển khai theo kiến trúc hiện tại của BQD Math, có
migration, kiểm tra quyền và tiêu chí nghiệm thu rõ ràng.

> Giả định: dòng “thêm tính năng ko up đề” được hiểu là **tạo đề không cần
> upload PDF**, bằng ngân hàng câu hỏi hoặc nhập câu hỏi thủ công. Nếu ý sản
> phẩm khác, phải xác nhận lại trước khi nhận task `BQD-09`.

## 1. Quy tắc chung cho mọi agent

Đọc trước khi sửa:

- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- README trong feature đang sửa
- tài liệu Next.js 16 trong `node_modules/next/dist/docs/` nếu đụng routing,
  Server Actions, cache hoặc cấu hình Next.js

Các ràng buộc bắt buộc:

- `src/app/` chỉ giữ route, page và layout; business logic đặt trong
  `src/features/`.
- Query học sinh phải ràng buộc quyền ngay trong câu query bằng `studentId`
  từ session. Không fetch rộng rồi lọc ở client.
- Không bao giờ gửi `correctAnswer` của đề thi xuống client trước khi học sinh
  nộp bài.
- Server Action/API phải tự kiểm tra role, trạng thái tài khoản, ownership và
  validate input; không tin hidden input hoặc state client.
- Production tiếp tục upload PDF trực tiếp lên GCS. Không tăng giới hạn Server
  Action production để né thiết kế signed upload.
- Migration production chỉ chạy bằng `prisma migrate deploy`; không chạy
  `migrate dev`, `db push` hoặc seed demo trên Cloud SQL production.
- Giữ tương thích dữ liệu cũ hoặc viết backfill trong migration.
- UI phải có loading, empty state, error state, keyboard focus và thông báo
  thành công/thất bại.
- Không trộn refactor không liên quan vào cùng task.

Lệnh kiểm tra tối thiểu trước khi bàn giao:

```bash
npm run lint
npm run build
npm run verify:slice-0
npm run verify:slice-1
npm run verify:slice-2
npm run verify:learning
```

Nếu task thêm hành vi chưa được các script trên bao phủ, phải bổ sung một script
`verify:*` hoặc test phù hợp. Ghi rõ những test cần dữ liệu seed/dev server.

## 2. Hiện trạng cần giữ lại

| Khu vực | Nền tảng đã có | Phần còn thiếu |
|---|---|---|
| Câu hỏi ôn tập | Học sinh đã tìm theo nội dung/chủ đề và lọc độ khó trong một chương | Filter admin, filter đầy đủ, phân trang, dùng lại trong màn tạo đề |
| Tài liệu | Có `Folder`, thư mục cha-con, tạo/xóa cơ bản, gán tài liệu vào thư mục | Tree tương tác, kéo thả, reorder, filter học sinh |
| Đề thi | Có upload PDF và `ExamFromBankForm` | Folder đề, bộ chọn câu tốt hơn, đề không PDF chuẩn hóa |
| Mật khẩu | Có quên mật khẩu, reset bởi admin và bắt đổi mật khẩu tạm | Người dùng chủ động đổi mật khẩu khi đang đăng nhập |
| Kết quả | Có kết quả từng lượt và thống kê theo từng đề | Hồ sơ tổng hợp theo một học sinh |
| Giao diện | Có responsive cơ bản và token màu | Dark mode hoàn chỉnh, audit mobile toàn hệ thống |

## 3. Thứ tự triển khai đề xuất

Không để nhiều agent cùng sửa `prisma/schema.prisma` hoặc cùng tạo migration tại
một thời điểm. Các wave sau có thể chạy song song nếu không đụng cùng file:

1. Wave A: `BQD-02`, `BQD-04`, `BQD-07`.
2. Wave B: `BQD-03` rồi `BQD-05` — cùng nền folder tree, nên ưu tiên một agent
   làm liên tiếp.
3. Wave C: `BQD-09`, sau khi filter câu hỏi và folder đề ổn định.
4. Wave D: `BQD-10` rồi `BQD-11`.
5. Wave E: `BQD-01`, khi DTO/filter của ba kho đã ổn định.
6. Wave F: `BQD-06`, sau đó `BQD-08` để audit giao diện cuối cùng một lần.

## BQD-01 — Tìm kiếm chung đề thi, tài liệu và câu hỏi

### Mục tiêu

Tạo một ô tìm kiếm chung cho ADMIN và STUDENT, trả kết quả theo ba nhóm: đề
thi, tài liệu và câu hỏi ôn tập. Kết quả phải tuân thủ đúng quyền của từng role.

### Backend

- Tạo feature `src/features/search/` gồm `types.ts`, `queries.ts`, README và
  component hiển thị.
- Chuẩn hóa query params: `q`, `type`, `classId`, `page` hoặc cursor.
- ADMIN tìm trên toàn bộ dữ liệu được quản lý.
- STUDENT chỉ thấy:
  - đề đã giao cho lớp đang theo học, đúng trạng thái/thời gian khả dụng;
  - tài liệu đã giao cho lớp đang theo học;
  - câu hỏi đã giao cho lớp đang theo học.
- Tìm không phân biệt hoa/thường trên các field phù hợp:
  - đề: `title`;
  - tài liệu: `title`, `fileName`;
  - câu hỏi: `content`, `topic`, `grade`, tên chương.
- Giới hạn tối đa 20 kết quả mỗi nhóm mỗi request và có phân trang. Không tải
  toàn bộ dữ liệu rồi filter trong React.
- DTO câu hỏi của STUDENT tuyệt đối không chứa `correctAnswer`, lời giải chưa
  được phép xem hoặc dữ liệu lớp không liên quan.
- Giai đoạn đầu dùng PostgreSQL `contains`/`ILIKE`. Chỉ thêm `pg_trgm` và index
  GIN khi đo được truy vấn chậm; nếu thêm phải có migration rõ ràng.

### UI

- Route `/tim-kiem` dùng được trên desktop/mobile.
- Thêm entry tìm kiếm vào navigation ADMIN và STUDENT.
- Search được phản ánh vào URL để refresh/back/forward vẫn đúng.
- Có tab `Tất cả`, `Đề thi`, `Tài liệu`, `Câu hỏi`; hiển thị loại, breadcrumb
  folder/chương, lớp và link đi đúng trang.
- Debounce chỉ dùng để cập nhật URL; server vẫn là nguồn dữ liệu chính.

### Acceptance criteria

- Cùng một từ khóa, ADMIN có thể thấy dữ liệu toàn hệ thống nhưng STUDENT A
  không thấy dữ liệu chỉ giao cho STUDENT B.
- Từ khóa rỗng không chạy full-table search; hiển thị hướng dẫn nhập từ khóa.
- Query đặc biệt `%`, `_`, dấu tiếng Việt và chuỗi dài không gây lỗi.
- Không có answer key trong HTML/RSC payload của kết quả học sinh.

### File dự kiến

- `src/features/search/*`
- `src/app/admin/tim-kiem/page.tsx`
- `src/app/(student)/tim-kiem/page.tsx` hoặc một route dùng chung có gate role
- `src/components/layout/Navbar.tsx`
- `src/components/layout/AdminSidebar.tsx`

## BQD-02 — Filter ngân hàng câu hỏi

### Mục tiêu

Filter câu hỏi nhất quán ở trang quản trị, trang ôn tập học sinh và bộ chọn câu
hỏi khi tạo đề.

### Bộ filter chuẩn

- Từ khóa nội dung/chủ đề.
- Chương.
- Khối/lớp (`grade`).
- Loại câu: trắc nghiệm, đúng/sai, trả lời ngắn.
- Độ khó.
- Lớp được giao.
- ADMIN bổ sung trạng thái lời giải: có/không lời giải, đang hiện/đang ẩn.
- Bộ chọn tạo đề bổ sung `đã chọn/chưa chọn` và sắp xếp.

### Implementation

- Tạo type/parser dùng chung, ví dụ
  `src/features/review-questions/filters.ts`; parser phải whitelist enum và
  normalize chuỗi.
- Chuyển trang ADMIN sang filter bằng query server và phân trang, không truyền
  toàn bộ ngân hàng câu hỏi vào client.
- Mở rộng query STUDENT hiện có, vẫn giữ enrollment trong `where`.
- Tách bộ chọn câu hỏi của `ExamFromBankForm` thành component có search/filter,
  giữ selection khi đổi filter hoặc trang.
- URL là nguồn trạng thái cho trang danh sách; form tạo đề có thể dùng state
  cục bộ nhưng request lấy dữ liệu phải phân trang.

### Acceptance criteria

- Kết hợp nhiều filter trả đúng giao của chúng.
- Nút “Xóa bộ lọc” đưa URL và UI về mặc định.
- Selection tạo đề không mất khi chuyển trang/filter.
- 1.000 câu hỏi vẫn không khiến page gửi toàn bộ dataset xuống browser.

### File dự kiến

- `src/features/review-questions/filters.ts`
- `src/features/review-questions/queries.ts`
- `src/features/review-questions/components/AdminReviewManager.tsx`
- `src/features/exams/components/ExamFromBankForm.tsx`
- `src/app/admin/cau-hoi-on-tap/page.tsx`
- `src/app/(student)/on-tap/[chapterId]/page.tsx`

## BQD-03 — Cây thư mục tài liệu kiểu VS Code và kéo thả

### Mục tiêu

Thay danh sách folder phẳng bằng cây thư mục trực quan có expand/collapse,
chọn folder, tạo folder con, đổi tên và kéo thả folder/tài liệu.

### Data model

Mở rộng `Folder` theo hướng dùng chung nhưng có namespace rõ ràng:

```prisma
enum FolderKind {
  DOCUMENT
  EXAM
}

model Folder {
  // field hiện có...
  kind     FolderKind @default(DOCUMENT)
  position Int        @default(0)
  exams    Exam[]
}
```

- Thêm `position` cho `Document` để reorder trong cùng folder.
- Backfill toàn bộ folder cũ thành `DOCUMENT`.
- Không dựa vào unique nullable của PostgreSQL để chặn folder gốc trùng tên;
  validate tên sibling trong transaction hoặc thêm partial unique index bằng
  SQL migration nếu thật sự cần.

### Backend actions

- `createFolder(kind, parentId, name)`.
- `renameFolder(folderId, name)`.
- `moveFolder(folderId, parentId, position)`.
- `moveDocument(documentId, folderId, position)`.
- `deleteFolder` chỉ xóa folder rỗng như hiện tại.
- Chặn đưa folder vào chính nó hoặc descendant; kiểm tra `kind` của parent;
  giới hạn độ sâu hợp lý, đề xuất 8 cấp.
- Reorder và move phải chạy transaction, normalize lại `position` để không có
  số âm/trùng không kiểm soát.

### UI

- Tạo component dùng chung `src/components/tree/ResourceTree.tsx`.
- Có chevron expand/collapse, icon folder mở/đóng, count trực tiếp, item đang
  chọn và breadcrumb.
- Kéo thả bằng `@dnd-kit/core`/`@dnd-kit/sortable`; bổ sung thao tác tương đương
  bằng keyboard và menu “Di chuyển đến…” cho accessibility/mobile.
- Drop zone phải phân biệt “đưa vào folder” và “sắp xếp trước/sau”.
- Optimistic UI phải rollback khi Server Action lỗi.
- Lưu trạng thái folder mở bằng `localStorage` theo user/kind, không lưu dữ liệu
  nhạy cảm.

### Acceptance criteria

- Di chuyển cây sâu nhiều cấp không tạo cycle.
- Reload vẫn giữ cấu trúc/order từ database.
- Không thể kéo tài liệu sang cây `EXAM`.
- Touch/mobile dùng được bằng menu dù drag khó thao tác.
- Folder có con hoặc tài liệu không bị xóa.

### File dự kiến

- `prisma/schema.prisma` + migration
- `src/components/tree/*`
- `src/features/documents/actions.ts`
- `src/features/documents/queries.ts`
- `src/features/documents/components/AdminDocumentsManager.tsx`
- `src/app/admin/tai-lieu/page.tsx`

## BQD-04 — Filter kho tài liệu ở chế độ học sinh

### Mục tiêu

Cho học sinh tìm và lọc các tài liệu mà mình được quyền xem.

### Filter

- Từ khóa theo tiêu đề/tên file.
- Folder và tùy chọn gồm folder con.
- Lớp.
- Loại file/content type.
- Có đáp án đang được công bố.
- Cho phép tải xuống.
- Sắp xếp: mới nhất, cũ nhất, tên A–Z, vừa cập nhật.

### Implementation

- `getDocumentsForCurrentStudent(filters)` phải giữ điều kiện enrollment ngay
  trong Prisma `where`.
- Dùng query params có parser whitelist.
- Folder options chỉ gồm folder chứa ít nhất một tài liệu học sinh được phép
  xem; không làm lộ tên folder private của lớp khác.
- Phân trang server; empty state phải phân biệt “chưa được giao tài liệu” và
  “không có kết quả phù hợp”.

### Acceptance criteria

- STUDENT không thể sửa URL `classId`/`folderId` để suy ra hoặc xem dữ liệu lớp
  khác.
- Filter kết hợp đúng, refresh giữ trạng thái.
- Mobile filter dùng drawer/details, không chiếm hết màn hình.

### File dự kiến

- `src/features/documents/queries.ts`
- `src/features/documents/filters.ts`
- `src/features/documents/components/StudentDocumentFilters.tsx`
- `src/app/(student)/tai-lieu/page.tsx`

## BQD-05 — Folder và cây thư mục cho đề thi

### Mục tiêu

ADMIN tổ chức đề theo cây riêng, chọn folder khi tạo/sửa và kéo thả đề trong
trang danh sách.

### Data model và backend

- Phụ thuộc `BQD-03`.
- Thêm `Exam.folderId`, relation `folder` và `position`.
- Folder của đề phải có `kind = EXAM`; action server từ chối folder tài liệu.
- Thêm action tạo folder ngay trong luồng tạo đề và action move/reorder đề.
- Khi xóa folder, giữ nguyên quy tắc chỉ xóa folder rỗng; không cascade xóa đề.

### UI

- Trang `/admin/de-thi` dùng tree bên trái và danh sách folder hiện tại bên
  phải trên desktop; mobile dùng nút mở drawer.
- Form tạo/sửa đề có combobox folder và nút “Tạo thư mục mới” inline.
- Breadcrumb hiển thị trên card đề và trang chi tiết.
- Filter trạng thái đề, lớp, mode và folder được phản ánh vào URL.

### Acceptance criteria

- Đề PDF và đề không PDF đều di chuyển/reorder như nhau.
- Folder tree tài liệu và đề hoàn toàn tách namespace.
- Xóa/đóng/publish đề không làm hỏng folder.
- STUDENT không thấy cấu trúc folder quản trị trừ khi sản phẩm yêu cầu rõ sau
  này.

### File dự kiến

- `prisma/schema.prisma` + migration
- `src/features/exams/admin-actions.ts`
- `src/features/exams/admin-queries.ts`
- `src/features/exams/components/*`
- `src/app/admin/de-thi/page.tsx`
- `src/app/admin/de-thi/tao-moi/page.tsx`

## BQD-06 — Chế độ tối

### Mục tiêu

Dark mode áp dụng cho toàn bộ public/auth/student/admin, không nháy theme khi
hydrate và tôn trọng lựa chọn hệ điều hành.

### Implementation

- Dùng ba lựa chọn `light`, `dark`, `system`.
- Có thể dùng `next-themes`; nếu không thêm dependency thì phải có script đặt
  class trước hydration với CSP nonce phù hợp. Không chấp nhận theme chỉ đổi
  sau khi React mount gây flash.
- Chuyển token trong `globals.css` sang semantic tokens cho background,
  surface, text, muted, border, primary, danger, success và overlay.
- Thêm selector `.dark` và `color-scheme: dark`.
- Rà tất cả màu hard-code như `bg-white`, `bg-red-50`, `text-slate-*`; thay bằng
  token hoặc variant dark tương ứng.
- Theme toggle đặt ở navbar student/public và admin sidebar; cùng một preference
  dùng cho toàn app.
- Chart, PDF canvas, dialog, input, focus ring và scrollbar phải đủ tương phản.

### Acceptance criteria

- Reload trực tiếp route bất kỳ không flash nền sáng.
- `system` đổi theo OS mà không cần refresh.
- Contrast text/form/control đạt WCAG AA ở các màn chính.
- Print PDF/nội dung vẫn nền sáng dễ đọc.
- Không có hydration mismatch trong console.

### File dự kiến

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/theme/*`
- `src/components/layout/Navbar.tsx`
- `src/components/layout/AdminSidebar.tsx`
- các component còn màu hard-code

## BQD-07 — Người dùng chủ động đổi mật khẩu

### Mục tiêu

Người dùng đang đăng nhập có thể đổi mật khẩu bất kỳ lúc nào, khác với flow
“bắt đổi mật khẩu tạm” hiện có.

### Security và backend

- Tạo action riêng, ví dụ
  `src/features/auth/actions/change-password.ts`.
- Bắt buộc session ACTIVE và đọc user từ DB.
- Với account có `passwordHash`: yêu cầu mật khẩu hiện tại, mật khẩu mới và xác
  nhận; verify bcrypt phía server.
- Mật khẩu mới dùng cùng validator/hash policy với đăng ký, khác mật khẩu cũ,
  không log plaintext và không trả hash.
- Account Google-only chưa có `passwordHash`: không cho đặt password chỉ dựa
  vào session trong task này; hướng người dùng qua flow OTP email để xác minh
  lại danh tính, hoặc tách thành task security riêng.
- Rate-limit theo user/IP nếu hạ tầng rate-limit đã có; tối thiểu chống double
  submit và trả lỗi chung cho sai mật khẩu.
- Sau khi đổi thành công đặt `mustChangePassword = false`, sign out session hiện
  tại và yêu cầu đăng nhập lại. Ghi chú rõ JWT session khác chưa bị revoke nếu
  chưa triển khai `sessionVersion`.

### UI

- Tạo route `/tai-khoan/doi-mat-khau` dùng cho cả ADMIN và STUDENT.
- Thêm link từ menu tài khoản.
- Có show/hide password, strength hints, caps-lock warning và trạng thái thành
  công rõ ràng.
- Không tái sử dụng nguyên trang `/doi-mat-khau`; trang đó tiếp tục dành cho
  mật khẩu tạm để tránh làm sai redirect bảo mật hiện tại.

### Acceptance criteria

- Sai mật khẩu hiện tại không thay đổi DB.
- Đổi thành công: mật khẩu cũ đăng nhập thất bại, mật khẩu mới đăng nhập được.
- User PENDING/SUSPENDED không gọi action trực tiếp được.
- Google-only nhận hướng dẫn an toàn, không crash.

### File dự kiến

- `src/features/auth/actions/change-password.ts`
- `src/features/auth/components/ChangePasswordForm.tsx`
- `src/app/tai-khoan/doi-mat-khau/page.tsx`
- navigation/account menu
- `scripts/verify-change-password.ts`

## BQD-08 — Tối ưu toàn hệ thống trên điện thoại

### Mục tiêu

Hoàn thành mobile audit sau khi các UI feature khác ổn định.

### Ma trận kiểm thử

Kiểm tra tối thiểu ở 360×800, 390×844, 768×1024 và desktop:

- đăng nhập/đăng ký/quên và đổi mật khẩu;
- navbar, admin sidebar;
- quản lý học sinh/lớp/câu hỏi/tài liệu/đề;
- tạo và sửa đề;
- cây thư mục và filter drawer;
- làm bài, PDF viewer, answer sheet, timer, trang kết quả;
- lịch học và dashboard.

### Quy chuẩn UI

- Không có horizontal scroll ở page; table thực sự cần thiết phải có wrapper
  và frozen/priority columns hoặc chuyển thành cards.
- Touch target tối thiểu 44×44 px cho thao tác chính.
- Form một cột ở mobile, keyboard không che nút submit, label/error đọc được.
- Sticky header/footer không che nội dung hoặc focus target.
- Dialog/drawer khóa scroll nền, trap focus và đóng được bằng Escape.
- Tree drag-and-drop luôn có phương án “Di chuyển đến…” không cần drag.
- Exam workspace mobile ưu tiên câu hỏi/phiếu trả lời; PDF có nút chuyển tab,
  zoom không làm tràn viewport.
- Tôn trọng safe-area inset và `prefers-reduced-motion`.

### Acceptance criteria

- Không có lỗi console/hydration trên các flow chính.
- Lighthouse mobile không có lỗi accessibility nghiêm trọng; CLS không tăng rõ
  rệt khi font/theme hydrate.
- Hoàn thành checklist thủ công có ảnh trước/sau cho các page thay đổi lớn.

### File dự kiến

- Các layout và component liên quan; không thay business logic trừ khi cần cho
  phân trang/mobile payload.
- Có thể thêm `docs/mobile-qa.md` để lưu checklist.

## BQD-09 — Tạo đề không cần upload PDF

### Mục tiêu

Hoàn thiện nền `ExamFromBankForm` để ADMIN tạo đề hoàn toàn từ ngân hàng câu
hỏi hoặc nhập câu thủ công, không dùng chuỗi rỗng làm sentinel cho PDF.

### Data model

- Đổi `Exam.examFileUrl` thành nullable hoặc thêm enum nguồn rõ ràng:

```prisma
enum ExamSource {
  PDF
  QUESTION_BANK
  MANUAL
}
```

- Backfill: URL khác rỗng là `PDF`; URL rỗng hiện tại là `QUESTION_BANK`.
- Server validate invariant: `PDF` bắt buộc có file; hai source còn lại bắt
  buộc có ít nhất một `ExamQuestion`.

### Backend/UI

- Giữ ba lựa chọn rõ ràng trên trang tạo đề: `Upload PDF`, `Ngân hàng câu hỏi`,
  `Nhập thủ công`.
- Dùng filter/selector từ `BQD-02`; cho reorder câu đã chọn trước khi tạo đề.
- Manual builder hỗ trợ đủ ba loại câu, đáp án, điểm và lời giải.
- Có preview trước khi lưu; total points và số câu cập nhật tức thời.
- Tạo đề + câu hỏi + liên kết lớp trong một transaction.
- Trang làm bài ẩn PDF pane khi không có PDF và dùng toàn chiều rộng cho nội
  dung câu hỏi.
- Trang xem trước/sửa/kết quả không được tạo link file cho đề không PDF.

### Acceptance criteria

- Tạo, publish, làm, autosave, nộp và chấm được đề không PDF.
- Không có request tới `/api/exams/.../file/exam` với source không phải PDF.
- Đề cũ có `examFileUrl = ""` được backfill và tiếp tục mở được.
- Không làm thay đổi snapshot kết quả những lượt đã nộp.

### File dự kiến

- `prisma/schema.prisma` + migration/backfill
- `src/features/exams/admin-actions.ts`
- `src/features/exams/components/ExamFromBankForm.tsx`
- component manual builder mới
- `src/features/exams/components/ExamWorkspace.tsx`
- các page preview/edit/result
- `scripts/verify-exam-without-pdf.ts`

## BQD-10 — Mã học sinh và mã lớp

### Mục tiêu

Thêm mã ổn định, dễ đọc để ADMIN tìm kiếm/quản lý học sinh và lớp. Mã quản lý
không được xem như mật khẩu hoặc token bí mật.

### Data model

- `User.studentCode String? @unique` chỉ áp dụng cho STUDENT.
- `Class.code String @unique` sau khi backfill.
- Chuẩn hóa uppercase, bỏ khoảng trắng; format đề xuất:
  - học sinh: `HS-XXXXXXXX`;
  - lớp: mã do ADMIN nhập, ví dụ `12A1-2026`, hoặc sinh mặc định có retry.
- Migration phải backfill record hiện có bằng giá trị duy nhất và không đổi mã
  ở các lần deploy sau.

### Backend/UI

- Thêm mã vào trang quản lý học sinh, class picker, trang lớp và CSV kết quả.
- Search học sinh theo mã; search lớp theo mã/tên.
- ADMIN có thể sửa mã lớp với validation/unique error thân thiện.
- Mã học sinh mặc định read-only; nếu cho sửa phải có audit log hoặc xác nhận
  riêng để tránh đứt quy trình đối soát.
- Không tự động cho học sinh gia nhập lớp chỉ bằng mã trong task này. Nếu cần
  self-enrollment, thiết kế invitation code có hạn/rotate riêng.

### Acceptance criteria

- Backfill không trùng mã ở dữ liệu hiện có.
- Tạo đồng thời nhiều học sinh/lớp không gây unique crash không xử lý.
- Search không phân biệt hoa/thường.
- Mã xuất hiện nhất quán trong bảng, picker và export.

### File dự kiến

- `prisma/schema.prisma` + migration/backfill
- `src/features/accounts/*`
- `src/features/classes/*`
- CSV/report liên quan
- seed và verify scripts

## BQD-11 — Hồ sơ kết quả học tập của từng học sinh

### Mục tiêu

ADMIN mở một học sinh và xem tổng hợp tiến độ học tập thay vì đi qua từng đề.

### Route và dữ liệu

- Route `/admin/hoc-sinh/[studentId]/ket-qua`.
- Query đặt tại feature mới `src/features/progress/` hoặc trong accounts nếu
  phạm vi nhỏ; luôn gọi `requireActiveAdminId`.
- Tổng hợp:
  - lớp đang/đã tham gia;
  - số đề được giao, đã làm, chưa làm;
  - điểm tốt nhất, điểm gần nhất, điểm trung bình theo đề/lớp/thời gian;
  - lịch sử lượt nộp và link tới kết quả cụ thể;
  - số câu ôn đã làm, tỉ lệ đúng theo chương/chủ đề/độ khó;
  - xu hướng 30/90 ngày và hoạt động gần nhất.
- Không tạo bảng aggregate ở phiên bản đầu. Query trực tiếp với select hẹp,
  phân trang lịch sử; chỉ thêm materialized summary sau khi đo hiệu năng.

### UI

- Link “Xem kết quả” trong bảng quản lý học sinh.
- Header có tên, mã học sinh, trạng thái và lớp.
- Filter lớp, khoảng ngày, loại hoạt động.
- Summary cards + bảng lịch sử; chart chỉ dùng khi giúp đọc xu hướng, có bảng
  hoặc text equivalent cho accessibility.
- Empty state riêng cho học sinh chưa được giao bài và đã được giao nhưng chưa
  làm.

### Security/semantics

- Kết quả lấy từ snapshot `AttemptAnswer`/`ExamAttempt` đã nộp; không chấm lại
  bằng answer key hiện tại.
- Review progress dùng `ReviewAttempt` và không làm lộ đáp án ngoài màn ADMIN.
- SUSPENDED vẫn xem được lịch sử; record bị xóa theo policy hiện tại thì dữ
  liệu cascade theo schema — phải ghi nhận rõ trong UI/docs nếu giữ policy này.

### Acceptance criteria

- Học sinh có nhiều lượt làm: metric best/latest/average đúng định nghĩa.
- Lọc theo lớp không đếm attempt của đề/lớp khác.
- Attempt đang mở không được tính là lượt hoàn thành.
- Trang hoạt động với học sinh chưa có dữ liệu và lịch sử lớn có phân trang.

### File dự kiến

- `src/features/progress/*`
- `src/app/admin/hoc-sinh/[studentId]/ket-qua/page.tsx`
- `src/features/accounts/components/AccountsTable.tsx`
- verify script cho aggregation

## 4. Definition of Done cho từng task

Agent chỉ đánh dấu hoàn tất khi đáp ứng toàn bộ:

- Scope và acceptance criteria đã xong; không chỉ dựng UI mock.
- Có kiểm tra quyền server và validation cho input mới.
- Có migration/backfill nếu đổi schema; migration chạy được trên database có dữ
  liệu cũ.
- `npm run lint` và `npm run build` thành công.
- Regression scripts liên quan thành công.
- Đã test ít nhất một happy path, một empty state và một forbidden path.
- Không để secret, file PDF test hoặc credential vào Git.
- Cập nhật README feature/docs nếu hành vi hoặc biến môi trường thay đổi.
- Bàn giao danh sách file đổi, migration, test đã chạy và rủi ro còn lại.

## 5. Prompt mẫu để giao một task cho agent

```text
Implement task BQD-XX trong docs/implementation-agent-backlog.md.

Đọc AGENTS.md, docs/architecture.md và README của feature liên quan trước khi
sửa. Chỉ làm đúng scope task này, giữ nguyên thay đổi hiện có của người khác.
Nếu task đổi Prisma schema, kiểm tra migration đang có và không dùng db push.
Thực hiện đầy đủ backend authorization, UI states, migration/backfill và test
theo acceptance criteria. Cuối cùng chạy lint, build và các verify script liên
quan; báo rõ lệnh nào thành công/thất bại, file đã đổi và rủi ro còn lại.
```
