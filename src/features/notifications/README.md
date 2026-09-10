# features/notifications

Thông báo trong ứng dụng cho học sinh. Thông báo được tạo từ thông báo lớp học,
chỉ hiển thị khi học sinh vẫn thuộc lớp và được đánh dấu đã đọc khi mở trang
`/thong-bao`.

- `queries.ts` — lấy số tin chưa đọc và danh sách thông báo của học sinh.
- `actions.ts` — đánh dấu toàn bộ thông báo đang hiển thị là đã đọc.
- `components/NotificationReadMarker.tsx` — gọi action sau khi trang thông báo mở.
- `types.ts` — DTO dùng ở giao diện.

Kênh email/SMS vẫn dùng chung model `Notification` và có thể được bổ sung sau.
