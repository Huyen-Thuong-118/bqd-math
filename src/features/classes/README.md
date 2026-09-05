# features/classes

Module "Lớp học": giáo viên quản lý nhiều lớp, HS chỉ vào được lớp mình.

**Đã triển khai:**
- `queries.ts` — danh sách/chi tiết lớp luôn lọc bằng `studentId` từ session.
- `actions.ts` — tạo, sửa, lưu trữ/khôi phục lớp; cập nhật enrollment hàng loạt; đăng thông báo.
- `components/AdminClassesManager.tsx` — UI vận hành, sĩ số và thống kê điểm/lượt làm.

Lớp `ARCHIVED` vẫn hiển thị lịch sử cho học sinh nhưng các action từ chối
enrollment, thông báo và nội dung mới.
