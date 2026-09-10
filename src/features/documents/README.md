# features/documents

Module "Tài liệu" — đề thi + tài liệu ôn tập có đáp án, admin tổ chức theo thư mục.

**Đã triển khai:**
- Thư mục nhiều cấp, upload, đổi tên, di chuyển, gán nhiều lớp và cập nhật phiên bản.
- Cây thư mục expand/collapse, kéo thả, reorder, breadcrumb và menu di chuyển
  dùng được bằng bàn phím/touch; trạng thái mở được lưu cục bộ theo namespace.
- Cloud Storage dùng signed PUT trực tiếp từ trình duyệt; local dùng storage private dự phòng.
- Route xem/tải kiểm tra session + enrollment, dùng signed GET 5 phút trên Cloud Storage.
- `DocumentClass` tách việc gán lớp khỏi metadata file; `DocumentVersion` giữ lịch sử.
- Danh sách học sinh tìm/lọc theo thư mục (có hoặc không gồm thư mục con), lớp,
  loại file, đáp án công bố, quyền tải và sắp xếp; query được phân trang ở server.

Học sinh chỉ query tài liệu qua lớp có `ClassEnrollment.studentId` đúng session.

Lệnh `npm run seed:bqd-thpt-2026` đồng thời thêm file tổng hợp 8 lần thi thử
vào thư mục tài liệu `Ôn thi TN THPT 2026` và giao cho tất cả lớp đang hoạt động.
