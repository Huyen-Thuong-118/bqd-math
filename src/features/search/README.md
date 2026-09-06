# Search

Tìm kiếm chung cho đề thi, tài liệu và câu hỏi. Điều kiện lớp/enrollment được
đặt trực tiếp trong Prisma query. DTO kết quả không chứa đáp án hoặc lời giải.
Query rỗng không chạy full-table search; mỗi nhóm phân trang tối đa 20 dòng và
chỉ đọc chuỗi ancestor của các folder thật sự xuất hiện trong trang kết quả.
