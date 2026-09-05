# Implementation — Lát cắt 1: giao đề và chấm điểm end-to-end

Lát cắt này cung cấp một luồng học sinh dùng được thật từ database: nhận đề
được giao theo lớp, bắt đầu/tiếp tục lượt làm, autosave, reload khôi phục, nộp
bài, server chấm và xem kết quả.

## Dữ liệu và migration

Migration `20260904200336_slice1_exam_grading` bổ sung:

- `ExamQuestion`: nội dung, options, answer key, điểm và lời giải.
- `Exam.mode`: phân biệt thi thử có giờ và luyện tập.
- `ExamAttempt.expiresAt` cùng snapshot số đúng/sai/bỏ trống.
- `AttemptAnswer`: snapshot từng câu tại thời điểm nộp; thay đổi answer key về
  sau không làm điểm lịch sử tự đổi.

Khi `SEED_DEMO_DATA=true`, `npm run seed` tạo idempotent:

- học sinh `student@bqdmath.local` ở trạng thái `ACTIVE`;
- lớp `Lớp Demo Lát cắt 1` và enrollment;
- đề thi thử 20 phút, tối đa 3 lượt;
- 10 câu trắc nghiệm, quan hệ giao đề vào lớp.

Không bật `SEED_DEMO_DATA` trên production.

## Luồng và ranh giới bảo mật

1. `/thi-thu` query đề có `ExamClass -> ClassEnrollment` chứa học sinh hiện
   tại; đề lớp khác không xuất hiện.
2. `startExam` kiểm tra lại tài khoản `ACTIVE`, assignment, thời gian mở đề,
   số câu và giới hạn lượt ở server. Attempt đang mở được tiếp tục thay vì tạo
   mới; `openKey` unique khóa race condition tạo hai attempt đồng thời; attempt
   hết giờ được chấm trước.
3. Trang làm bài chỉ select `id/number/content/options/points`. Trường
   `correctAnswer` không đi vào RSC payload hoặc network trước khi nộp.
4. Click đáp án cập nhật UI ngay. Buffer gửi nhiều thay đổi trong một request
   mỗi 2,5 giây và flush toàn bộ trước khi nộp.
5. API autosave kiểm tra session, ownership, trạng thái chưa nộp, deadline,
   số câu hợp lệ và kích thước batch. Timestamp chính thức do server gán.
6. Reload đọc lịch sử theo thứ tự và lấy lựa chọn cuối của mỗi câu.
7. Hết giờ client tự gọi nộp; server ngừng nhận autosave sau deadline.
8. `submitAttemptForUser` chấm trong transaction. Lệnh claim
   `submittedAt = null` giúp nhiều request nộp đồng thời vẫn chỉ tạo một bộ
   snapshot.
9. Kết quả chỉ query bằng cả `attemptId + examId + userId`; user khác nhận
   404 và không biết attempt có tồn tại hay không.

## Quy tắc chấm lát cắt 1

- Hỗ trợ trắc nghiệm một đáp án A/B/C/D.
- Chuẩn hóa đáp án bằng trim + uppercase.
- Mỗi câu có `points`; tổng điểm quy đổi về thang 10 và làm tròn hai chữ số.
- Không chọn là bỏ trống; chọn sai không có điểm.
- Lưu score, số đúng/sai/trống và snapshot từng câu.
- `hideWrongAnswers=true` ẩn đáp án đúng của câu sai trên trang kết quả.

## Kiểm thử

Khởi động DB, seed và dev server rồi chạy:

```bash
npm run verify:slice-1
```

Script kiểm tra grading, ownership, autosave/reload, không lộ answer key,
nộp idempotent, snapshot 10 câu và trang kết quả. User/attempt tạm do script
tạo luôn được xóa chính xác trong `finally`.

## Ngoài phạm vi

Admin CRUD/publish/version/giao đề bằng UI thuộc lát cắt 2. Lát cắt này dùng
seed để chứng minh lõi làm bài trước. PDF, câu trả lời ngắn, thống kê nhiều
lượt và load test cũng chưa nằm trong phạm vi hiện tại.
