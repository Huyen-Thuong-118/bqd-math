# features/review-questions

Module "Câu hỏi ôn tập" — chia theo chương, có lời giải chữ hoặc video.

**Đã triển khai:**
- Ngân hàng theo chương, khối, chủ đề, độ khó và ba loại câu hỏi.
- Bộ filter chuẩn dùng chung cho ADMIN/STUDENT: từ khóa, chương, lớp, khối,
  chủ đề, loại, độ khó và trạng thái lời giải; danh sách phân trang ở server.
- Bộ chọn tạo đề tìm/lọc/phân trang mà không mất câu đã chọn khi đổi trang.
- Gán lại cho nhiều lớp và sửa nội dung độc lập với việc gán.
- Chấm đồng bộ phía server, ghi mọi `ReviewAttempt` và hiển thị tỷ lệ đúng.
- Lời giải chữ, URL ảnh và Cloudflare Stream UID; đáp án đúng không có trong DTO ban đầu.
- Import đề PDF ngay tại `/admin/cau-hoi-on-tap`: OCR tách câu, trả ảnh gốc để
  giáo viên đối chiếu, cho sửa từng bản nháp rồi nhận hoặc bỏ qua từng câu.
- Công thức trong đề, phương án, đáp án và lời giải được giữ dưới dạng LaTeX và
  dựng bằng KaTeX ngay trong màn hình duyệt cũng như màn hình ôn tập.
- Hình thuộc nội dung câu hỏi/lời giải được tách riêng khỏi ảnh chụp đối chiếu.
  Khi giáo viên nhận câu, các hình này được sao chép vào storage của ứng dụng và
  chỉ được phục vụ qua route có kiểm tra quyền truy cập.
- Route import và route ảnh nguồn đều xác thực lại quyền ADMIN; câu chỉ được ghi
  vào ngân hàng sau khi vượt qua validation chương, lớp, loại câu và đáp án.

Mọi query và action của học sinh đều ràng buộc enrollment bằng `studentId` từ session.
