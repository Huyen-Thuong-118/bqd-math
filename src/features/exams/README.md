# features/exams

Module đề thi, lượt làm bài, autosave, chấm điểm và kết quả.

## Đã triển khai

- `queries.ts` chỉ trả đề được gán vào lớp của học sinh hiện tại; DTO trang
  làm bài không chứa answer key.
- `actions.ts` bắt đầu/tiếp tục attempt và nộp bài, đều tự kiểm tra session.
- `repository.ts` validate batch, ownership, deadline và trạng thái trước khi
  ghi lịch sử đáp án.
- `service.ts` + `grading.ts` chấm thang 10, idempotent và lưu snapshot.
- `useAnswerBuffer.ts` cập nhật UI ngay, gộp autosave mỗi 2,5 giây, retry khi
  lỗi và flush trước khi nộp.
- `ExamList`, `ExamWorkspace`, `ExamTimer` tạo luồng học sinh hoàn chỉnh.
- Route kết quả hiển thị điểm, đúng/sai/bỏ trống và lời giải.
- `admin-actions.ts` tạo/sửa/publish/xóa đề, cấu hình lịch, lớp, thư mục, quyền
  tải/lời giải. Đề có nguồn rõ ràng `PDF`, `QUESTION_BANK` hoặc `MANUAL`;
  hai nguồn sau không tạo URL file giả.
- `ManualExamForm` nhập trực tiếp đủ ba loại câu, đáp án, điểm, lời giải,
  reorder và preview; `ExamFromBankForm` tìm/lọc/phân trang nhưng vẫn giữ
  selection. Tạo đề, câu và liên kết lớp chạy trong một transaction.
- Cây thư mục đề dùng namespace `EXAM`, hỗ trợ tạo/đổi tên/di chuyển/reorder;
  action server chặn cycle, sai namespace và cây sâu quá 8 cấp.
- Nút “Quét bằng Gemini” gửi PDF từ server tới Vertex AI bằng IAM của Cloud Run;
  model cấu hình bởi `GEMINI_MODEL` (mặc định `gemini-3.1-flash-lite`) và yêu cầu structured JSON
  cho cấu trúc đề cùng answer key. Nếu Gemini lỗi hoặc không đọc đủ đáp án,
  hệ thống mới fallback sang worker OCR local trong `services/ocr`: PyMuPDF lấy
  text layer trước, Tesseract `vie+eng` chỉ xử lý trang scan. Giáo viên xác nhận
  kết quả trước khi lưu; không cần tạo hoặc lưu Gemini API key.
  Parser hỗ trợ cả bảng `1. D`/`Đáp án: D` và bảng `1) D`/`Đáp án D` trong
  các bộ PDF mẫu; `verify:slice-2` chạy regression với cả `1.pdf` đến `3.pdf`.
- `AnswerSheet` hiển thị nội dung câu và phương án cho đề không PDF; hỗ trợ
  A–D, bốn ý đúng/sai và câu trả lời ngắn. Đúng/sai được chấm điểm từng ý.
- Workspace đề không PDF dùng toàn chiều rộng. Trên mobile, đề PDF mặc định ưu
  tiên bài làm và có tab riêng để chuyển sang PDF mà không làm tràn page.
- `PdfViewer` render PDF canvas có scroll, zoom, watermark và ẩn thao tác tải.
- Route file kiểm tra session, lớp, trạng thái nộp và cấu hình giáo viên trước
  khi trả dữ liệu; storage dùng Google Cloud Storage hoặc fallback private local.

## Chưa triển khai

- OCR ảnh phiếu tô viết tay/tô giấy.

Kiểm thử tích hợp local bằng `npm run verify:slice-1` và
`npm run verify:slice-2` khi dev server đang chạy.
