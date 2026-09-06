# Bảo mật — checklist cho bản public

Tài liệu này liệt kê các biện pháp bảo mật cần có trước khi đưa web ra
công khai, đánh dấu cái nào đã làm (`[x]`) và cái nào còn phải làm (`[ ]`).
Web lưu dữ liệu của học sinh — phần lớn là **trẻ vị thành niên** — nên mức
yêu cầu bảo mật/pháp lý cao hơn 1 web thông thường.

## 1. Mật khẩu & xác thực

- [x] Mật khẩu chỉ lưu dạng **hash 1 chiều** (bcrypt, 12 rounds) —
      `lib/password.ts`. Không ai, kể cả admin, đọc ngược lại được.
- [x] Admin **KHÔNG xem lại** mật khẩu HS. Thay vào đó dùng chức năng
      **Reset**: sinh mật khẩu tạm ngẫu nhiên (`generateTempPassword()`),
      admin đọc/gửi cho HS đúng 1 lần lúc tạo, HS bắt buộc đổi mật khẩu ở
      lần đăng nhập kế tiếp (`mustChangePassword` trong schema).
- [x] Cài NextAuth (`src/auth.ts`) — session dùng cookie `httpOnly`,
      `secure`, `sameSite=lax` (mặc định của NextAuth, không cần tự cấu hình
      thêm nếu không có lý do đặc biệt).
- [ ] **Rate limit đăng nhập** — chặn brute-force đoán mật khẩu. Khuyến
      nghị: [Upstash Ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
      (free tier đủ dùng ở quy mô này) hoặc Vercel Firewall — giới hạn
      ví dụ 5 lần thử sai / phút / IP.
- [ ] Validate input bằng Zod ở mọi API route nhận dữ liệu từ người dùng
      (đã có trong danh sách cài đặt ban đầu, chưa áp dụng vào route thật).

## 2. Vận chuyển & hạ tầng

- [x] Cloud Run kết nối Cloud SQL bằng Unix socket qua Cloud SQL connector.
- [x] Deploy trên Cloud Run với HTTPS bắt buộc.
- [x] CSP, HSTS, chống MIME sniffing/clickjacking và Permissions Policy được
      cấu hình tập trung trong `next.config.ts`.
- [x] File PDF/video không có link public vĩnh viễn — signed URL hết hạn
      ngắn (`lib/storage.ts`, `lib/stream.ts`).
- [ ] Bật domain `.edu.vn` với HTTPS ngay từ đầu, không public bản HTTP.

## 3. Kiểm soát truy cập (Authorization)

- [x] API autosave kiểm tra session, account `ACTIVE`, ownership của attempt,
      deadline, trạng thái chưa nộp và số câu hợp lệ trước khi ghi.
- [x] Proxy (`src/proxy.ts`, trước gọi là Middleware) chặn toàn bộ `/admin/**`
      nếu `role !== "ADMIN"`, và `/lop-hoc|/on-tap|/thi-thu|/tai-lieu` nếu
      chưa đăng nhập, thiếu hồ sơ, phải đổi mật khẩu hoặc status
      PENDING/SUSPENDED. Server action quản trị kiểm tra lại quyền và trạng
      thái trực tiếp từ DB, không dựa riêng vào Proxy/JWT.
- [x] Danh sách/trang làm bài chỉ query đề được gán vào lớp của chính học sinh;
      kết quả yêu cầu đúng `userId + examId + attemptId`.

## 4. Secrets

- [x] `.env` nằm trong `.gitignore` — không commit lên GitHub.
- [x] Secret production lưu trong Google Secret Manager và cấp quyền tối thiểu
      cho đúng runtime service account.
- [ ] Xoay vòng (rotate) `NEXTAUTH_SECRET` và API key nếu nghi ngờ rò rỉ.

## 5. Dữ liệu cá nhân & pháp lý Việt Nam

Việt Nam có **Luật Bảo vệ dữ liệu cá nhân (số 91/2025/QH15)**, có hiệu lực
từ 1/1/2026, thay thế Nghị định 13/2023/NĐ-CP. Luật này **quy định riêng
mức bảo vệ cao hơn cho dữ liệu trẻ em** — cần sự đồng ý của người đại diện
theo pháp luật (phụ huynh) khi xử lý dữ liệu trẻ em, và trao cho người
dùng quyền được biết, đồng ý, truy cập, sửa, xoá dữ liệu của mình.

*Mình không phải luật sư — đây là thông tin tham khảo, không phải tư vấn
pháp lý. Vì web thu thập dữ liệu trẻ vị thành niên (tên, SĐT phụ huynh,
kết quả học tập), nên hỏi ý kiến luật sư hoặc đơn vị tư vấn pháp lý trước
khi ra mắt công khai để đảm bảo tuân thủ đúng, đặc biệt các mục sau:*

- [ ] Có **chính sách bảo mật** (Privacy Policy) công khai trên web, nói
      rõ thu thập dữ liệu gì, dùng để làm gì, lưu bao lâu
- [ ] Có cơ chế xin **đồng ý của phụ huynh** khi đăng ký tài khoản HS
      (đặc biệt nếu HS dưới 1 độ tuổi nhất định — cần luật sư xác nhận mốc cụ thể)
- [ ] Có cách để phụ huynh/HS **yêu cầu xoá dữ liệu** khi không dùng nữa
- [ ] Không chia sẻ SĐT phụ huynh, kết quả học tập cho bên thứ 3 ngoài mục
      đích vận hành web (kể cả nhà cung cấp SMS — kiểm tra điều khoản của họ)

## 6. Khác

- [ ] Chạy `npm audit` định kỳ, cập nhật dependency có lỗ hổng
- [ ] Kiểm tra Cloud SQL automated backup và point-in-time recovery định kỳ.
- [ ] Theo dõi log tập trung bằng Cloud Logging, cân nhắc thêm Sentry khi lớn hơn.
