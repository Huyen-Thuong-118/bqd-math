# Implementation — quản lý lớp và nội dung học tập

Lát cắt này thay các trang placeholder bằng luồng dữ liệu thật cho lớp học,
tài liệu, câu hỏi ôn tập và hoàn thiện thêm vòng đời đề thi.

## Đã hoàn thành

- CRUD/lưu trữ lớp, enrollment học sinh hàng loạt, thông báo và thống kê lớp.
- Trang học sinh chỉ hiển thị lớp/nội dung có enrollment đúng session; lớp lưu
  trữ giữ lịch sử nhưng không nhận nội dung mới.
- Thư mục nhiều cấp; tài liệu gán nhiều lớp; đổi tên, di chuyển, quyền tải,
  công bố đáp án và lịch sử phiên bản.
- Cloud Storage signed PUT/GET thời hạn 5 phút; storage local private là fallback dev.
- Ngân hàng câu hỏi theo chương/chủ đề/khối/độ khó, ba loại câu, lời giải chữ,
  ảnh và Cloudflare Stream UID; chấm server và lưu tiến độ.
- Đề có `DRAFT/PUBLISHED/CLOSED`, xem trước, scoring policy, thống kê điểm,
  câu sai nhiều, tỷ lệ hoàn thành theo lớp và xuất CSV.
- Autosave upsert `AttemptAnswer` + append `AnswerHistory` trong một transaction
  có row lock; submit idempotent khóa cùng row để không chấm thiếu click cuối.
- UI làm bài có local recovery, đồng bộ foreground, trạng thái lưu, điều hướng
  nhanh, đánh dấu xem lại và cảnh báo câu trống.

## Kiểm tra

```bash
npm run verify:learning
npm run verify:slice-1
npm run lint
npm run build
```

Hai migration mới là `20260905090000_learning_management` và
`20260905103000_live_attempt_answers`.
