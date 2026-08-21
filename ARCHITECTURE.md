# Tại sao tổ chức project như vậy?

Nguyên tắc duy nhất: **`app/` chỉ lo routing, `features/` chứa tất cả logic.**

## 1. `app/` = URL, không phải nơi viết code

Mỗi file trong `app/` chỉ nên làm 2 việc: lấy dữ liệu từ `features/*/queries.ts`
và render UI từ `features/*/components/` hoặc `components/`. Nếu bạn thấy
mình đang viết `prisma.exam.findMany()` trực tiếp trong `page.tsx` — dừng lại,
đó là dấu hiệu logic đang lẫn vào chỗ routing.

**Lợi ích:** đổi cấu trúc URL (đổi tên route, gộp trang) không đụng tới logic
nghiệp vụ. Ngược lại, sửa logic chấm điểm không cần đụng vào file routing.

## 2. `features/` chia theo NGHIỆP VỤ, không chia theo LOẠI FILE

Cách tổ chức cũ thường thấy: gom hết `components/`, gom hết `hooks/`,
gom hết `utils/` — muốn sửa 1 tính năng phải nhảy qua 5-6 thư mục khác nhau.

Cách này làm ngược lại: mỗi tính năng (`exams`, `classes`, `review-questions`...)
là **1 thư mục tự chứa** — component, logic, type của tính năng đó nằm chung
một chỗ. Muốn sửa "Phòng thi thử" → mở đúng `features/exams/`, không cần đi tìm.

6 thư mục trong `features/` map thẳng 1-1 với 6 mục trên thanh tác vụ
(Lớp học, Câu hỏi ôn tập, Phòng thi thử, Tài liệu...) — nhìn `features/`
là nhìn thấy toàn bộ sản phẩm.

## 3. Route groups `(public)` / `(student)` — không đổi URL

Dấu ngoặc `(public)`, `(student)` trong tên thư mục là quy ước của Next.js:
dùng để NHÓM code, không xuất hiện trong đường dẫn thật. Ví dụ
`app/(student)/lop-hoc/page.tsx` vẫn chạy ở URL `/lop-hoc`, không phải
`/student/lop-hoc`.

Lý do tách nhóm dù URL không đổi: để sau này dễ bọc thêm điều kiện đăng nhập
riêng cho từng nhóm (`(student)` cần check session, `(public)` thì không) mà
không sợ áp nhầm rule của nhóm này lên nhóm kia.

`admin/` KHÔNG có dấu ngoặc vì admin thực sự nên có URL riêng biệt
(`/admin/...`) — không lẫn với route học sinh, dễ áp rule bảo mật ở tầng
middleware sau này (chặn toàn bộ `/admin/*` nếu không phải role ADMIN).

## 4. `components/` vs `features/*/components/` — khác nhau ở đâu?

| Đặt ở đâu | Khi nào |
|-----------|---------|
| `components/ui/` | Component cực kỳ tổng quát, không biết gì về nghiệp vụ (Button, Input, Dialog) |
| `components/layout/` | Khung sườn xuất hiện ở mọi trang (Navbar, Footer) |
| `features/exams/components/` | Component chỉ có ý nghĩa trong ngữ cảnh 1 tính năng (`ExamTimer`, `AnswerSheet`) |

Câu hỏi tự kiểm tra: "Component này có tự đứng riêng ở 1 project Toán khác
không liên quan gì đến thi cử không?" — Có → `components/ui`. Không → để
trong `features/`.

## 5. Vì sao Prisma schema gộp 1 file thay vì chia nhỏ?

Ở quy mô project này (một trường/trung tâm dạy Toán), một file
`schema.prisma` vẫn còn đủ ngắn để đọc từ trên xuống dưới trong vài phút —
chia nhỏ ra nhiều file lúc này chỉ làm khó tra cứu quan hệ giữa các bảng.
Nếu sau này schema vượt ~500 dòng, cân nhắc dùng
[Prisma multi-file schema](https://www.prisma.io/docs/orm/prisma-schema/overview/location#multi-file-prisma-schema).

## 6. Vì sao mỗi `features/*` có `README.md` riêng?

Đây là cách trả lời câu "nhìn vào hiểu được" một cách triệt để nhất: không
cần hỏi ai, không cần đọc hết code — mở `features/exams/README.md` là biết
module đó định làm gì, file nào chịu trách nhiệm gì, còn thiếu gì.
Khi code thật được viết vào, cập nhật luôn README đó — coi nó như "bản đồ"
of thư mục, không phải tài liệu viết 1 lần rồi bỏ quên.
