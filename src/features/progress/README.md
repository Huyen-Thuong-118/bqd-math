# Student progress

Hồ sơ tổng hợp kết quả chỉ dành cho ADMIN. Query luôn xác thực admin ở server,
đọc điểm đề từ `ExamAttempt` đã nộp và dữ liệu câu hỏi từ `ReviewAttempt`.
Điểm lịch sử không được chấm lại bằng đáp án hiện tại.
`metrics.ts` giữ phép tính best/latest/average và số đề hoàn thành ở dạng hàm
thuần để query và script `verify:backlog` dùng chung cùng một định nghĩa.
