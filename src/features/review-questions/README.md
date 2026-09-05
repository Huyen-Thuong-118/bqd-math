# features/review-questions

Module "Câu hỏi ôn tập" — chia theo chương, có lời giải chữ hoặc video.

**Đã triển khai:**
- Ngân hàng theo chương, khối, chủ đề, độ khó và ba loại câu hỏi.
- Tìm kiếm/lọc, gán lại cho nhiều lớp và sửa nội dung độc lập với việc gán.
- Chấm đồng bộ phía server, ghi mọi `ReviewAttempt` và hiển thị tỷ lệ đúng.
- Lời giải chữ, URL ảnh và Cloudflare Stream UID; đáp án đúng không có trong DTO ban đầu.

Mọi query và action của học sinh đều ràng buộc enrollment bằng `studentId` từ session.
