# Mobile QA — BQD Math

Checklist này dùng sau mỗi thay đổi layout. Viewport chuẩn: `360×800`,
`390×844`, `768×1024` và desktop từ `1280px`. Chạy với cả theme sáng/tối và
kiểm tra console không có hydration/runtime error.

## Kết quả audit 2026-09-07

| Khu vực | 360/390 | 768 | Desktop | Điểm cần kiểm tra |
|---|---:|---:|---:|---|
| Auth + đổi mật khẩu | ✓ | ✓ | ✓ | Form một cột, show/hide, Caps Lock, nút 44px |
| Navbar + admin menu | ✓ | ✓ | ✓ | Drawer khóa nền, trap focus, Escape, trả focus |
| Học sinh + lớp | ✓ | ✓ | ✓ | Mobile cards; bảng rộng có vùng scroll riêng |
| Filter câu hỏi/tài liệu | ✓ | ✓ | ✓ | `details` thu gọn, URL giữ trạng thái |
| Cây tài liệu/đề | ✓ | ✓ | ✓ | Hàng/nút 44px, menu “Di chuyển đến…” thay drag |
| Tạo/sửa đề | ✓ | ✓ | ✓ | Grid về một cột, preview không tràn viewport |
| Làm bài + PDF | ✓ | ✓ | ✓ | Mặc định “Bài làm”, tab PDF riêng, zoom chỉ scroll trong viewer |
| Kết quả + tiến độ | ✓ | ✓ | ✓ | Chart có text tương đương; bảng có wrapper scroll |
| Dashboard + lịch | ✓ | ✓ | ✓ | Card tự xuống hàng, không có page horizontal scroll |

## Quy tắc regression

- Mọi thao tác chính có chiều cao/rộng tương tác tối thiểu 44px.
- Chỉ table/PDF/tree viewport được cuộn ngang nội bộ; `body` không cuộn ngang.
- Sticky header không che focus target; iOS safe-area được cộng ở hai cạnh body.
- Dialog/drawer mới phải khóa scroll nền, trap focus và đóng bằng Escape.
- Luôn giữ `prefers-reduced-motion`; print buộc nền sáng.
- Chụp ảnh trước/sau cho route thay đổi lớn khi chạy QA thủ công trên thiết bị
  thật; không commit ảnh có email, số điện thoại hoặc dữ liệu học sinh thật.
