# features/documents

Module "Tài liệu" — đề thi + tài liệu ôn tập có đáp án, admin tổ chức theo thư mục.

**Đã triển khai:**
- Thư mục nhiều cấp, upload, đổi tên, di chuyển, gán nhiều lớp và cập nhật phiên bản.
- Cloud Storage dùng signed PUT trực tiếp từ trình duyệt; local dùng storage private dự phòng.
- Route xem/tải kiểm tra session + enrollment, dùng signed GET 5 phút trên Cloud Storage.
- `DocumentClass` tách việc gán lớp khỏi metadata file; `DocumentVersion` giữ lịch sử.

Học sinh chỉ query tài liệu qua lớp có `ClassEnrollment.studentId` đúng session.
