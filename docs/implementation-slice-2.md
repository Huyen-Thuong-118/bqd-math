# Implementation — Lát cắt 2: đề thi PDF và phiếu tô đáp án

Lát cắt này hoàn chỉnh đường dọc từ giáo viên tạo đề đến học sinh mở PDF,
tô đáp án, nộp bài và xem lời giải theo quyền giáo viên cấu hình.

## Giáo viên

Tại `/admin/de-thi/tao-moi`, giáo viên có thể:

- tải file đề PDF bắt buộc và file đáp án/lời giải PDF tùy chọn, tối đa 20 MB/file;
- chọn thi thử có đồng hồ hoặc luyện tập, số lượt làm, vĩnh viễn hoặc khung giờ;
- bật/tắt download, lời giải sau khi nộp và ẩn đáp án đúng của câu sai;
- giao một đề cho nhiều lớp đang hoạt động;
- tạo phiếu chuẩn THPT gồm 12 câu trắc nghiệm, 4 câu đúng/sai (mỗi câu 4 ý)
  và 6 câu trả lời ngắn, hoặc chỉnh số lượng/loại từng phần;
- nhập answer key theo đúng loại câu để máy chấm tự động.

Nút “Quét bằng Gemini” ưu tiên gửi file đề và file lời giải từ backend tới
Gemini bằng `GEMINI_API_KEY`; model mặc định là `gemini-3.1-flash-lite` và trả
structured JSON gồm cấu trúc phần thi cùng answer key. Nếu Gemini lỗi hoặc
không trả đủ đáp án, hệ thống mới fallback sang container OCR local. Worker
OCR ưu tiên text layer bằng PyMuPDF; chỉ trang không có text mới chạy Tesseract
`vie+eng`. Giáo viên luôn kiểm tra kết quả trước khi tạo đề; API key chỉ tồn
tại phía server và hệ thống không tự lưu key chấm chưa được xác nhận.

Danh sách `/admin/de-thi` hiển thị lớp, số câu, lượt làm, thời gian, link xem
file và thao tác mở/ẩn lời giải hoặc đóng đề ngay.

## Học sinh và bảo mật file

- Trang làm bài đặt đề bên trái và phiếu đáp án bên phải trên desktop; mobile
  xếp dọc. Lời giải chỉ mở ở kết quả sau khi nộp và giáo viên cho phép.
- PDF render thành canvas bằng PDF.js, cuộn toàn bộ trang và zoom 60–200%.
- Khi không cho download, UI không có nút tải và API cũng trả 403 cho
  `?download=1`; đây là kiểm tra server chứ không chỉ giấu nút.
- API file kiểm tra session mới nhất, vai trò, trạng thái tài khoản và quan hệ
  lớp. File local không đặt trong `public/` và không có URL tĩnh để chia sẻ.
- Chặn menu chuột phải, kéo file và in khung PDF; watermark là biện pháp răn
  đe best-effort. Website không thể ngăn tuyệt đối ảnh chụp màn hình từ hệ
  điều hành hoặc điện thoại khác.

## Storage

Khi có `GCS_BUCKET_NAME`, file lưu private trên Google Cloud Storage. Khi local
chưa có bucket, file lưu ở `storage/uploads/` (đã gitignore). Cả hai
backend dùng chung key và API quyền nên không đổi giao diện khi chuyển môi trường.

PDF production được upload trực tiếp từ trình duyệt lên Cloud Storage bằng signed URL;
Server Action chỉ nhận storage key và metadata nhỏ. Server kiểm tra quyền admin,
kích thước object, Content-Type và magic bytes `%PDF-` trước khi lưu vào database.

## Chấm điểm và giới hạn hiện tại

PDF lời giải được Gemini Vision đọc trực tiếp trước; parser OCR local là đường
dự phòng. Giáo viên phải xác nhận rồi mới tạo đề; nếu không nhận đủ key thì hệ
thống không tự điền một phần để tránh lệch số câu. Chấm ảnh phiếu tô giấy vẫn
cần pipeline thị giác cùng bộ kiểm thử riêng.

Đúng/sai chấm điểm từng ý theo mốc 0 / 0,1 / 0,25 / 0,5 / 1 điểm. Trả lời
ngắn hiện so khớp chuỗi sau khi trim và viết hoa; giáo viên cần nhập cùng quy
ước dấu phẩy thập phân. Chưa có sửa/xóa/version đề và OCR chưa đọc công thức
thành nội dung câu hỏi có cấu trúc.

## Kiểm thử

Khi dev server và database đang chạy:

```bash
npm run verify:slice-2
```

Script tạo dữ liệu tạm, kiểm tra path traversal, quyền xem đề, khóa download,
khóa lời giải trước khi nộp và quyền mở lời giải sau khi nộp, rồi tự dọn dữ liệu.
