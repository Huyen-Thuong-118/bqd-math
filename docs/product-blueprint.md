# BQD Math — Đặc tả sản phẩm và giải pháp kỹ thuật

> Tài liệu nguồn duy nhất mô tả hệ thống cần xây, phạm vi từng tính năng,
> trạng thái hiện tại, giải pháp kỹ thuật và thứ tự triển khai.

## 1. Tầm nhìn sản phẩm

BQD Math là hệ thống học và luyện thi Toán cho một giáo viên hoặc trung tâm
quy mô nhỏ–vừa. Hệ thống phải giúp giáo viên quản lý học sinh, lớp học, tài
liệu, câu hỏi ôn tập và đề thi; đồng thời cho học sinh một nơi duy nhất để học,
làm bài, nhận điểm và xem lại quá trình tiến bộ.

Mục tiêu quan trọng nhất:

- Giáo viên vận hành lớp và giao bài mà không cần ghép nhiều công cụ rời rạc.
- Học sinh vào đúng lớp, thấy đúng nội dung được giao và làm bài thuận tiện.
- Việc lưu đáp án, nộp bài và chấm điểm phải đáng tin cậy kể cả khi nhiều học
  sinh làm đồng thời.
- Dữ liệu cá nhân và kết quả học tập của học sinh được bảo vệ đúng mức.

## 2. Vai trò người dùng

### 2.1. Khách chưa đăng nhập

- Xem trang giới thiệu trung tâm.
- Xem lịch học công khai.
- Xem thông tin liên hệ.
- Đăng ký tài khoản học sinh.
- Đăng nhập hoặc khôi phục mật khẩu.

### 2.2. Học sinh (`STUDENT`)

- Chờ giáo viên duyệt sau khi đăng ký.
- Xem lớp mình đang tham gia.
- Xem tài liệu và đề được giao cho lớp.
- Ôn tập theo chương.
- Làm bài luyện tập hoặc thi thử.
- Xem điểm, đáp án được phép công bố, lời giải và lịch sử làm bài.
- Theo dõi tiến độ học tập cá nhân.

### 2.3. Giáo viên/quản trị (`ADMIN`)

- Duyệt, từ chối, khóa, kích hoạt và reset mật khẩu học sinh.
- Tạo và quản lý lớp học.
- Thêm/xóa học sinh trong lớp.
- Quản lý lịch dạy công khai.
- Quản lý kho tài liệu.
- Quản lý ngân hàng câu hỏi ôn tập.
- Tạo, cấu hình và giao đề cho một hoặc nhiều lớp.
- Xem lượt làm, điểm và thống kê theo học sinh/lớp/đề.
- Gửi thông báo qua email hoặc SMS khi cần.

Không xây nhiều loại giáo viên trong giai đoạn đầu. Một role `ADMIN` có toàn
quyền giúp hệ thống đơn giản và phù hợp quy mô hiện tại.

## 3. Trạng thái repo hiện tại

Ký hiệu:

- **Đã có**: luồng chính đã hiện diện trong code.
- **Một phần**: có UI, model hoặc nền kỹ thuật nhưng chưa thành luồng dùng được.
- **Chưa có**: mới là route rỗng, placeholder hoặc ý tưởng trong README.

| Nhóm | Trạng thái | Ghi chú |
|---|---|---|
| Trang chủ | Một phần | UI tốt, lịch dạy vẫn là dữ liệu mẫu |
| Đăng ký học sinh | Đã có | Tạo tài khoản `PENDING` |
| Đăng nhập email/SĐT | Đã có | Credentials + session JWT |
| Google OAuth | Đã implement | Cần điền Google credentials để chạy OAuth thật |
| Quên mật khẩu OTP | Một phần | Có UI/API; gửi thật cần cấu hình Resend |
| Phân quyền route | Đã có | Chặn admin/student và trạng thái tài khoản |
| Quản lý tài khoản HS | Đã có | Duyệt, từ chối, khóa, kích hoạt |
| Dashboard admin | Đã có | Có số liệu tổng quan từ database |
| Quản lý lớp | Chưa có | Có model và route, chưa có CRUD/UI |
| Kho tài liệu | Chưa có | Có model và Cloud Storage client, chưa có luồng sử dụng |
| Câu hỏi ôn tập | Chưa có | Có model, route còn placeholder |
| Tạo/giao đề | Chưa có | Có model cơ bản, chưa có UI và answer key chuẩn |
| Làm bài | Đã có lát cắt lõi | Danh sách đề thật, timer, autosave, reload và ownership |
| Chấm điểm | Đã có lát cắt lõi | Trắc nghiệm một đáp án, server chấm và lưu snapshot |
| Kết quả/thống kê | Một phần | Có kết quả từng attempt; chưa có dashboard lịch sử/thống kê |
| Email/SMS | Một phần | Có nền email OTP; thông báo nghiệp vụ chưa có |
| Deploy/monitoring | Chưa có | Có cấu hình Vercel cơ bản |

Kết luận: repo hiện có nền xác thực, phân quyền, database và giao diện khung;
chưa có một luồng học tập hoàn chỉnh từ đầu đến cuối.

## 4. Phạm vi tính năng cần xây

### 4.1. Trang chủ và thông tin công khai

#### Yêu cầu

- Hero giới thiệu phương pháp/giá trị của BQD Math.
- Lịch học theo thứ trong tuần, giờ, trình độ và hình thức học.
- Thông tin giáo viên, địa chỉ, bản đồ, Facebook, điện thoại/Zalo.
- CTA đăng ký, đăng nhập và xem lịch.
- Trang chính sách bảo mật và điều khoản sử dụng.

#### Giải pháp

- Lấy lịch từ `TeachingSchedule`, không để mock trong component.
- Admin cập nhật lịch và thông tin liên hệ từ dashboard.
- Nội dung ít thay đổi có thể render server-side và cache ngắn.

### 4.2. Tài khoản và xác thực

#### Yêu cầu

- Đăng ký bằng họ tên, email, SĐT học sinh, SĐT phụ huynh và mật khẩu.
- Tài khoản mới ở trạng thái `PENDING` và chưa được vào khu vực học.
- Admin duyệt thành `ACTIVE` hoặc từ chối hồ sơ.
- Admin có thể khóa tài khoản thành `SUSPENDED`.
- Đăng nhập bằng email hoặc SĐT; Google là tùy chọn.
- Quên mật khẩu qua OTP email.
- Admin reset mật khẩu tạm, học sinh phải đổi ở lần đăng nhập tiếp theo.
- Tài khoản Google mới phải hoàn tất SĐT trước khi dùng tính năng học.

#### Giải pháp

- Dùng Auth.js/NextAuth v5 với JWT session như hiện tại.
- Mật khẩu hash bcrypt; không bao giờ trả `passwordHash` về client.
- Mọi server action tự kiểm tra session/role, không chỉ dựa vào Proxy.
- Validate server bằng schema dùng chung (khuyến nghị Zod).
- Rate limit đăng nhập, gửi OTP và xác minh OTP.

### 4.3. Quản lý học sinh

#### Yêu cầu

- Danh sách theo trạng thái: chờ duyệt, đang hoạt động, đã khóa.
- Tìm kiếm theo tên, email hoặc SĐT.
- Xem lớp, lượt làm bài và kết quả gần đây của từng học sinh.
- Duyệt/từ chối/khóa/kích hoạt/reset mật khẩu.
- Import danh sách từ CSV là tính năng giai đoạn sau.

#### Giải pháp

- Truy vấn phân trang ở server; không tải toàn bộ học sinh về browser.
- Ghi `AuditLog` cho thao tác nhạy cảm của admin.
- Từ chối hồ sơ `PENDING` có thể xóa; học sinh đã hoạt động nên khóa mềm trước
  khi xóa vĩnh viễn.

### 4.4. Quản lý lớp học

#### Yêu cầu admin

- Tạo/sửa/lưu trữ lớp, chọn trình độ, lịch và mô tả.
- Thêm hoặc xóa nhiều học sinh khỏi lớp.
- Giao đề, câu hỏi ôn tập và tài liệu cho một hoặc nhiều lớp.
- Xem sĩ số và thống kê lớp.

#### Yêu cầu học sinh

- Chỉ thấy lớp mình được xếp.
- Xem thông báo, tài liệu và bài tập trong từng lớp.

#### Giải pháp

- Dùng quan hệ nhiều-nhiều `ClassEnrollment`.
- Mọi query học sinh phải có điều kiện `studentId = session.user.id`.
- Lớp lưu trữ (`ARCHIVED`) không nhận nội dung mới nhưng vẫn giữ lịch sử.

### 4.5. Kho tài liệu

#### Yêu cầu

- Tạo thư mục nhiều cấp.
- Upload PDF/tài liệu, đổi tên, di chuyển, cập nhật phiên bản.
- Gán tài liệu cho lớp.
- Chọn có cho tải xuống hay chỉ xem online.
- Chọn có công bố file đáp án hay không.
- Học sinh chỉ thấy tài liệu thuộc lớp mình.

#### Giải pháp

- Metadata nằm trong PostgreSQL; file thật lưu Google Cloud Storage.
- Client upload qua signed URL để file lớn không đi xuyên qua Next.js server.
- URL xem/tải có hạn sử dụng ngắn.
- PDF viewer dùng PDF.js/canvas và watermark tên học sinh khi cần.
- Không dùng URL public vĩnh viễn cho tài liệu riêng tư.

### 4.6. Ngân hàng câu hỏi ôn tập

#### Yêu cầu

- Tổ chức theo khối/chương/chủ đề và độ khó.
- Tìm kiếm, lọc và tái sử dụng câu hỏi cho nhiều lớp.
- Hỗ trợ trắc nghiệm một đáp án, đúng/sai và trả lời ngắn.
- Có lời giải chữ, hình ảnh và video.
- Học sinh trả lời từng câu, nhận phản hồi và xem lời giải theo cấu hình.
- Lưu số lần làm và tỷ lệ đúng theo chủ đề.

#### Giải pháp

- Chuẩn hóa `QuestionType`, `Question`, `QuestionOption` hoặc JSON options.
- Tách nội dung câu hỏi khỏi việc gán câu hỏi vào lớp.
- Video lời giải lưu trên Cloudflare Stream; DB chỉ giữ video UID.
- Chấm câu ôn tập đồng bộ vì tải nhẹ; ghi `ReviewAttempt` để phân tích tiến độ.

### 4.7. Quản lý đề thi

#### Yêu cầu admin

- Tạo đề từ PDF hoặc từ ngân hàng câu hỏi.
- Cấu hình tiêu đề, thời gian mở/đóng, thời lượng, số lần làm tối đa.
- Chọn chế độ `MOCK` (có giờ) hoặc `PRACTICE` (không giới hạn giờ).
- Khai báo cấu trúc phiếu trả lời và đáp án đúng.
- Cấu hình điểm từng câu/phần, ẩn hiện đáp án và cho phép tải file.
- Gán một đề cho nhiều lớp.
- Xem trước đề bằng đúng giao diện học sinh.
- Xuất bản/đóng đề; không để chỉnh answer key tùy tiện sau khi có lượt làm.

#### Giải pháp dữ liệu

`Exam` hiện chưa đủ để chấm điểm. Cần bổ sung tối thiểu:

- `ExamQuestion`: thứ tự, loại câu, nội dung tùy chọn, options, đáp án đúng,
  điểm, lời giải.
- `ExamVersion` hoặc cơ chế khóa đề sau khi xuất bản để lịch sử không đổi.
- `scoringPolicy`: chính sách tính điểm theo phần; tránh hard-code trong UI.
- `publishedAt`, `status`: `DRAFT`, `PUBLISHED`, `CLOSED`.

Đáp án đúng chỉ được đọc ở server khi chấm bài, không nằm trong payload trang
làm bài.

### 4.8. Học sinh làm bài

#### Luồng chuẩn

1. Học sinh mở danh sách đề được giao.
2. Hệ thống kiểm tra lớp, thời gian mở đề và số lượt còn lại.
3. Học sinh bấm “Bắt đầu”; server tạo `ExamAttempt` và trả thời điểm hết hạn.
4. Trang làm bài hiển thị đề, phiếu trả lời, tiến độ và đồng hồ.
5. Chọn đáp án cập nhật UI ngay và tự lưu nền.
6. Reload trang vẫn khôi phục đáp án mới nhất.
7. Học sinh bấm nộp hoặc hệ thống tự nộp khi hết giờ.
8. Server khóa lượt làm, chấm điểm đúng một lần và trả kết quả.

#### Yêu cầu UX

- Hiển thị câu đã trả lời/chưa trả lời/đang đánh dấu xem lại.
- Điều hướng nhanh theo số câu.
- Cảnh báo số câu còn trống trước khi nộp.
- Responsive cho điện thoại và desktop.
- Mất mạng ngắn không làm mất đáp án vừa chọn; có trạng thái “đang lưu/đã lưu”.
- Khi hết giờ phải dùng thời gian server làm nguồn sự thật.

#### Giải pháp kỹ thuật

- Tạo `AttemptAnswer` giữ đáp án mới nhất với unique
  `(attemptId, questionId)` để load/chấm nhanh.
- Giữ `AnswerHistory` append-only nếu cần audit lịch sử thay đổi.
- Client buffer thay đổi trong 1–3 giây rồi gửi batch.
- API lưu batch phải kiểm tra session, ownership, trạng thái attempt và deadline.
- Upsert `AttemptAnswer` và append lịch sử trong một transaction.
- Timer client tính từ `expiresAt` do server trả; không polling từng giây.
- Đồng bộ server định kỳ thưa và khi tab quay lại foreground.
- `submitExam` phải idempotent: gọi lại nhiều lần vẫn chỉ có một kết quả.

### 4.9. Chấm điểm và kết quả

#### Yêu cầu

- Chấm tự động các loại câu được hỗ trợ.
- Hiển thị tổng điểm, số đúng/sai/bỏ trống và thời gian làm.
- Xem chi tiết từng câu theo chính sách công bố của đề.
- Có thể ẩn đáp án đúng khi học sinh làm sai.
- Xem lịch sử nhiều lần làm và điểm cao nhất.
- Admin xem phân bố điểm, câu sai nhiều và kết quả theo lớp.

#### Giải pháp

- Grading service là hàm thuần phía server, có unit test độc lập.
- Chuẩn hóa câu trả lời trước khi so sánh, đặc biệt dấu phẩy/chấm và khoảng
  trắng ở câu trả lời ngắn.
- Quy tắc điểm đúng/sai nhiều ý phải cấu hình được theo đề.
- Chấm nhẹ có thể chạy trong transaction nộp bài; chấm nặng/OCR cần queue.
- Lưu snapshot điểm và chi tiết chấm để thay đổi answer key sau này không làm
  điểm lịch sử tự đổi.

### 4.10. Thống kê học tập

#### Học sinh

- Điểm gần đây, điểm cao nhất và số bài đã làm.
- Tiến độ theo chương/chủ đề.
- Các câu hoặc chủ đề thường sai.

#### Admin

- Số học sinh đã/chưa làm theo đề.
- Điểm trung bình, trung vị và phân bố điểm.
- Câu sai nhiều nhất.
- So sánh giữa lớp và theo thời gian.
- Xuất CSV kết quả.

#### Giải pháp

- MVP tính trực tiếp bằng query có index.
- Khi dữ liệu lớn, tạo bảng aggregate hoặc job tổng hợp; chưa cần data
  warehouse ở quy mô hiện tại.

### 4.11. Thông báo

#### Yêu cầu

- Email khi tài khoản được duyệt, có đề mới hoặc mật khẩu được reset.
- Tùy chọn SMS cho phụ huynh với sự kiện quan trọng.
- Lưu trạng thái gửi thành công/thất bại và cho phép retry.

#### Giải pháp

- Resend cho email; nhà cung cấp SMS nội địa cho SMS.
- Không gửi email/SMS trong transaction nghiệp vụ chính.
- Ghi notification/outbox vào DB rồi worker/job gửi lại an toàn.

## 5. Kiến trúc giải pháp đề xuất

### 5.1. Kiến trúc tổng thể

Giữ **modular monolith**, chưa tách microservice:

```text
Browser
  ↓
Next.js App Router
  ├── Server Components: đọc dữ liệu và render
  ├── Server Actions: mutation từ form/dashboard
  ├── Route Handlers: autosave, upload callback, integration
  └── Auth.js: session và phân quyền
  ↓
Feature layer (`src/features/*`)
  ├── validation
  ├── authorization
  ├── queries/actions
  └── domain services (grading, assignment, notification)
  ↓
PostgreSQL + Prisma
  ├── dữ liệu nghiệp vụ
  └── migration có version trong Git

Cloud Storage: PDF/tài liệu       Stream: video       Resend/SMS: thông báo
```

Lý do:

- Hai người phát triển vẫn hiểu và deploy dễ dàng.
- Transaction nghiệp vụ nằm chung một process và database.
- Cloud Run scale web theo tải; Cloud SQL connector quản lý kết nối bảo mật.
- Chỉ tách worker/queue khi chấm bài hoặc gửi thông báo thực sự nặng.

### 5.2. Quy ước folder theo lát cắt dọc

```text
src/features/exams/
├── components/          # UI chỉ của tính năng thi
├── hooks/               # state/timer/autosave phía client
├── actions.ts           # mutation có auth + validation
├── queries.ts           # query đã áp quyền truy cập
├── grading.ts           # domain logic chấm điểm thuần
├── validation.ts        # schema input
└── types.ts             # DTO an toàn gửi client

src/app/(student)/thi-thu/
├── page.tsx             # chỉ ráp query + component
└── [examId]/page.tsx

src/app/api/exams/
└── attempts/[attemptId]/answers/route.ts  # endpoint autosave mỏng
```

Không gọi Prisma trực tiếp trong client component. Route/page chỉ điều phối;
logic nghiệp vụ và quyền truy cập nằm trong feature.

### 5.3. Môi trường

- Local: mỗi developer một PostgreSQL Docker riêng.
- Development/staging: một database cloud riêng để test tích hợp.
- Production: database và bucket riêng, không dùng chung với staging.
- `.env` không commit; `.env.example` chỉ chứa tên biến và dữ liệu local mẫu.
- Migration được commit; một người tạo migration cho mỗi thay đổi schema.

## 6. Mô hình dữ liệu mục tiêu

Các nhóm chính:

| Nhóm | Model |
|---|---|
| Danh tính | `User`, `Account`, `Session`, `PasswordResetOtp` |
| Lớp học | `Class`, `ClassEnrollment` |
| Tài liệu | `Folder`, `Document`, `DocumentClass` nếu cần nhiều lớp |
| Đề thi | `Exam`, `ExamVersion`, `ExamQuestion`, `ExamClass` |
| Lượt làm | `ExamAttempt`, `AttemptAnswer`, `AnswerHistory` |
| Ôn tập | `Chapter`, `ReviewQuestion`, `ClassReviewQuestion`, `ReviewAttempt` |
| Vận hành | `TeachingSchedule`, `Notification`, `AuditLog`, `ContactInfo` |

Index tối thiểu cần có:

- `ClassEnrollment(studentId, classId)` unique.
- `ExamClass(classId, examId)` unique.
- `ExamAttempt(userId, examId, startedAt)`.
- `AttemptAnswer(attemptId, questionId)` unique.
- `AnswerHistory(attemptId, questionId, changedAt)`.
- `ReviewAttempt(userId, questionId, attemptedAt)`.
- `Notification(status, nextRetryAt)` nếu dùng outbox.

## 7. Phân quyền bắt buộc

| Hành động | Khách | Học sinh | Admin |
|---|---:|---:|---:|
| Xem trang công khai | Có | Có | Có |
| Đăng ký | Có | Không cần | Không cần |
| Xem lớp của mình | Không | Có | Có |
| Xem lớp người khác | Không | Không | Có |
| Bắt đầu/lưu/nộp lượt làm của mình | Không | Có | Không cần |
| Đọc lượt làm người khác | Không | Không | Có |
| Tạo/sửa/giao đề | Không | Không | Có |
| Duyệt/khóa tài khoản | Không | Không | Có |

Mỗi query/mutation phải kiểm tra lại quyền ở server. Ẩn nút hoặc chặn route ở
Proxy chỉ là UX, không phải hàng rào bảo mật cuối cùng.

## 8. Yêu cầu phi chức năng

### 8.1. Hiệu năng và tải

- Mục tiêu ban đầu: 500 học sinh làm bài đồng thời.
- Không ghi DB cho từng click; dùng batch autosave.
- Không polling timer mỗi giây.
- Dùng pooled `DATABASE_URL` khi deploy serverless.
- Query danh sách phải phân trang và có index.
- File lớn upload thẳng object storage bằng signed URL.

### 8.2. Độ tin cậy

- Autosave hiển thị trạng thái rõ ràng và retry khi lỗi.
- Nộp bài idempotent và chạy trong transaction.
- Server quyết định deadline và trạng thái cuối.
- Backup database; kiểm thử phục hồi định kỳ.
- Không thay đổi/xóa answer key của đề đã có lượt làm mà không versioning.

### 8.3. Bảo mật

- Hash mật khẩu, cookie an toàn, HTTPS production.
- Rate limit login, OTP và endpoint autosave/nộp bài.
- Validate mọi input ở server.
- Ownership check cho class, document, exam và attempt.
- Không gửi answer key hoặc secret storage xuống client.
- Signed URL ngắn hạn cho file riêng tư.
- Audit log cho thao tác admin quan trọng.
- Log lỗi không chứa mật khẩu, OTP, token hoặc dữ liệu nhạy cảm.

### 8.4. Dữ liệu trẻ em

- Có chính sách bảo mật dễ hiểu.
- Ghi nhận sự đồng ý phù hợp của phụ huynh trước khi xử lý dữ liệu trẻ em.
- Có quy trình xuất, sửa và xóa dữ liệu theo yêu cầu hợp lệ.
- Chỉ thu thập dữ liệu thực sự cần cho việc học.
- Cần rà soát pháp lý chuyên môn trước khi public; tài liệu này không thay thế
  tư vấn pháp lý.

### 8.5. Khả năng sử dụng

- Mobile-first, bàn phím dùng được và có focus state.
- Màu trạng thái không phải dấu hiệu duy nhất; luôn có nhãn chữ/icon.
- Tôn trọng `prefers-reduced-motion`.
- Thông báo lỗi bằng tiếng Việt, nói rõ người dùng cần làm gì tiếp theo.

## 9. Chiến lược kiểm thử

### Unit test

- Hàm chấm điểm từng loại câu.
- Chuẩn hóa câu trả lời ngắn.
- Kiểm tra thời gian mở/đóng đề và số lượt còn lại.
- Validation đăng ký, tạo đề và answer payload.

### Integration test

- Học sinh không thể ghi đáp án vào attempt của người khác.
- Hết giờ không thể thay đổi đáp án.
- Nộp hai lần chỉ sinh một kết quả.
- Học sinh không thuộc lớp không thấy đề/tài liệu.
- Admin action từ session học sinh bị từ chối.

### End-to-end test

- Đăng ký → admin duyệt → đăng nhập.
- Admin tạo lớp/giao đề → học sinh thấy đề.
- Bắt đầu → chọn đáp án → reload → khôi phục → nộp → xem điểm.
- Khóa tài khoản đang đăng nhập → lần truy cập sau bị chặn.

### Load test

- Kịch bản 500 user bắt đầu và autosave gần đồng thời.
- Đo p95 latency, error rate, số connection DB và tỷ lệ mất batch.
- Chỉ tuyên bố sẵn sàng thi thật sau khi đạt ngưỡng đã thống nhất.

## 10. Roadmap theo lát cắt dọc

Mỗi lát cắt phải tạo ra một luồng người dùng dùng được; không làm toàn bộ UI
rồi mới quay lại database/API.

### Lát cắt 0 — Nền tảng (phần lớn đã có)

- Auth, role, account status.
- PostgreSQL/Prisma local.
- Admin dashboard cơ bản.
- Duyệt và khóa tài khoản.

**Hoàn thành khi:** admin và một học sinh `ACTIVE` đăng nhập đúng quyền trên
database local.

### Lát cắt 1 — Giao một đề và chấm điểm end-to-end

- Seed một học sinh, một lớp, một đề 10 câu và quan hệ giao đề.
- Học sinh thấy danh sách đề thật từ DB.
- Bắt đầu attempt, làm bài, autosave, reload khôi phục.
- Nộp bài, server chấm và hiện kết quả.
- Ownership check đầy đủ.

**Đây là lát cắt nên làm tiếp theo.** Chưa cần upload PDF/admin tạo đề trong
lát cắt này; dữ liệu seed giúp kiểm chứng lõi làm bài trước.

### Lát cắt 2 — Admin tạo lớp và giao đề

- CRUD lớp và enrollment.
- CRUD đề/câu hỏi/answer key.
- Gán đề cho nhiều lớp và preview giao diện học sinh.
- Học sinh nhận đúng đề theo lớp.

### Lát cắt 3 — Lịch sử và thống kê

- Danh sách các lượt làm, điểm cao nhất.
- Chi tiết kết quả và lời giải.
- Dashboard theo lớp/đề, xuất CSV.

### Lát cắt 4 — Ôn tập theo chương

- Admin CRUD ngân hàng câu hỏi.
- Gán câu hỏi vào lớp.
- Học sinh luyện, xem lời giải và lưu tiến độ.

### Lát cắt 5 — Kho tài liệu

- Folder tree, upload Cloud Storage, signed URL, PDF viewer.
- Gán tài liệu cho lớp và cấu hình tải/đáp án.

### Lát cắt 6 — Lịch dạy và thông báo

- Admin CRUD lịch dạy thay dữ liệu mock.
- Email nghiệp vụ và outbox/retry.
- SMS phụ huynh nếu thực sự cần.

### Lát cắt 7 — Production hardening

- Rate limit, audit log, privacy/consent.
- E2E/load test, monitoring, backup/restore.
- Staging, Vercel production, domain và HTTPS.

## 11. Tiêu chí nghiệm thu lát cắt 1

Lát cắt làm bài chỉ được coi là xong khi tất cả điều kiện sau đạt:

- [x] Có tài khoản student `ACTIVE`, lớp và đề mẫu trong seed local.
- [x] Student chỉ thấy đề của lớp mình.
- [x] Đề ngoài thời gian cho phép không thể bắt đầu.
- [x] Bắt đầu tạo đúng một attempt hợp lệ.
- [x] Chọn đáp án cập nhật ngay và có trạng thái lưu.
- [x] Reload không mất đáp án đã lưu.
- [x] API từ chối attempt của user khác.
- [x] Hết giờ không nhận thêm thay đổi và tự nộp.
- [x] Nộp nhiều lần không chấm/trừ lượt nhiều lần.
- [x] Answer key không xuất hiện trong network/RSC payload trước khi nộp.
- [x] Điểm được tính ở server và lưu snapshot.
- [x] Trang kết quả hiển thị tổng điểm, đúng/sai/trống.
- [x] Unit test grading và integration test ownership đều đạt.
- [x] ESLint, TypeScript và production build đều đạt.

## 12. Những việc chưa nên làm ngay

- Không tách microservice khi modular monolith còn đáp ứng tốt.
- Không dùng AI/OCR để đọc đề trước khi luồng tạo đề thủ công hoạt động ổn.
- Không làm SMS trước email nếu chưa có nhu cầu vận hành rõ ràng.
- Không tối ưu dashboard bằng data warehouse khi dữ liệu còn nhỏ.
- Không lưu file PDF/video trực tiếp trong PostgreSQL.
- Không dùng dữ liệu học sinh thật trong môi trường local/staging.
- Không deploy public trước khi xử lý ownership của API lưu đáp án.

## 13. Definition of Done chung

Một tính năng chỉ được xem là hoàn thành khi:

- Có luồng UI dùng được trên mobile và desktop.
- Có auth/authorization ở server.
- Input được validate và lỗi có thông báo rõ ràng.
- Query không làm lộ dữ liệu ngoài phạm vi người dùng.
- Có trạng thái loading, empty, error và success.
- Migration/seed được cập nhật nếu thay đổi database.
- Có test phù hợp với rủi ro nghiệp vụ.
- ESLint, TypeScript và build production đạt.
- README của feature và tài liệu này được cập nhật trạng thái.

## 14. Quyết định triển khai hiện tại

- Framework: Next.js 16 App Router + TypeScript.
- UI: Tailwind CSS v4, giữ theme Navy/Pastel hiện có.
- Database: PostgreSQL + Prisma 7.
- Auth: Auth.js/NextAuth v5, JWT session.
- Local DB: PostgreSQL 16 bằng Docker Compose.
- Hosting dự kiến: Vercel.
- PDF/tài liệu: Google Cloud Storage.
- Video: Cloudflare Stream.
- Email: Resend.
- Kiến trúc: modular monolith, feature-first, triển khai theo lát cắt dọc.

Các quyết định này đủ cho MVP và quy mô mục tiêu ban đầu. Chỉ thay đổi khi có
số liệu vận hành chứng minh giải pháp hiện tại không còn đáp ứng.
