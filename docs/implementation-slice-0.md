# Implementation — Lát cắt 0: tài khoản và phân quyền

Tài liệu này mô tả phần đã triển khai cho nền tảng tài khoản BQD Math. Lát
cắt hoàn thành khi admin/giáo viên và một học sinh `ACTIVE` đăng nhập đúng
quyền trên PostgreSQL local; tài khoản chưa duyệt hoặc bị khóa không vào được
khu vực học tập.

## Vai trò và trạng thái

Hệ thống cố ý chỉ có hai role:

- `ADMIN`: giáo viên/quản trị viên, được tạo bằng seed, không cho người dùng
  tự chọn role khi đăng ký.
- `STUDENT`: học sinh đăng ký bằng form hoặc Google.

Mỗi tài khoản có một trong ba trạng thái:

- `PENDING`: chờ giáo viên duyệt.
- `ACTIVE`: được phép sử dụng hệ thống.
- `SUSPENDED`: bị khóa; cron sẽ xóa sau 30 ngày nếu không kích hoạt lại.

## Luồng đăng ký và đăng nhập

### Email/SĐT và mật khẩu

1. Học sinh đăng ký họ tên, email, SĐT học sinh, SĐT phụ huynh và mật khẩu.
2. Server validate lại toàn bộ input, bcrypt mật khẩu và tạo user `PENDING`.
3. Giáo viên vào `/admin/hoc-sinh` để duyệt hoặc từ chối.
4. Chỉ học sinh `ACTIVE` đăng nhập được bằng email hoặc SĐT.

### Google OAuth

1. Người dùng chọn đăng nhập/đăng ký bằng Google.
2. Nếu email trùng tài khoản đã có, Auth.js liên kết Google vào đúng tài
   khoản đó. Nhờ vậy admin seed sẵn có thể đăng nhập Google bằng cùng email.
3. User Google mới luôn nhận mặc định `STUDENT + PENDING`; client không thể
   tự cấp quyền `ADMIN`.
4. Vì Google không cung cấp SĐT, user mới được chuyển tới
   `/hoan-tat-ho-so` để nhập SĐT học sinh và phụ huynh.
5. Sau khi hoàn tất hồ sơ, user tới `/cho-duyet`; giáo viên duyệt xong mới
   vào được `/lop-hoc`.

Google provider chỉ được nạp khi cả `GOOGLE_CLIENT_ID` và
`GOOGLE_CLIENT_SECRET` tồn tại. Nếu thiếu, nút Google bị vô hiệu hóa và form
Credentials vẫn hoạt động bình thường.

## Quyết định điều hướng và bảo vệ quyền

`/sau-dang-nhap` là điểm điều hướng chung. Route này đọc lại user mới nhất từ
database, không tin trạng thái có thể đã cũ trong JWT:

| Điều kiện | Trang đến |
|---|---|
| Tài khoản bị khóa | `/tai-khoan-bi-khoa` |
| Admin đang hoạt động | `/admin` |
| Học sinh Google thiếu SĐT | `/hoan-tat-ho-so` |
| Học sinh chờ duyệt | `/cho-duyet` |
| Học sinh phải đổi mật khẩu tạm | `/doi-mat-khau` |
| Học sinh hoạt động | `/lop-hoc` |

`src/proxy.ts` tiếp tục query trạng thái mới nhất cho route được bảo vệ. Mọi
server action quản trị cũng tự kiểm tra admin trong DB và kiểm tra đúng chuyển
trạng thái (`PENDING -> ACTIVE`, `ACTIVE -> SUSPENDED`,
`SUSPENDED -> ACTIVE`); không dựa riêng vào UI hay Proxy.

## Quản lý tài khoản phía giáo viên

Tại `/admin/hoc-sinh`, giáo viên có thể:

- duyệt hồ sơ `PENDING` đã đủ hai SĐT;
- từ chối và xóa hồ sơ `PENDING`;
- khóa học sinh `ACTIVE`;
- kích hoạt lại học sinh `SUSPENDED`;
- đặt lại mật khẩu cho học sinh `ACTIVE`.

Reset mật khẩu tạo chuỗi ngẫu nhiên và chỉ hiển thị một lần. DB chỉ lưu bcrypt
hash, đặt `mustChangePassword = true`, sau đó chặn khu vực học cho đến khi học
sinh tạo mật khẩu riêng tại `/doi-mat-khau`.

## Cấu hình Google local

Trong Google Cloud Console, tạo OAuth Client loại **Web application** và thêm:

```text
Authorized JavaScript origin: http://localhost:3000
Authorized redirect URI:      http://localhost:3000/api/auth/callback/google
```

Sau đó điền vào `.env`:

```env
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
```

Khởi động lại `npm run dev` sau khi sửa biến môi trường. Khi deploy, thêm
origin/redirect URI tương ứng với domain production và đặt hai secret trong
Environment Variables của nền tảng deploy, không commit `.env`.

## Cách kiểm thử lát cắt 0

1. Chạy `npm run db:up`, `npm run db:migrate`, `npm run seed`, `npm run dev`.
2. Đăng nhập admin seed và mở `/admin/hoc-sinh`.
3. Mở cửa sổ ẩn danh, đăng ký một học sinh; xác nhận chưa đăng nhập được.
4. Admin duyệt; xác nhận học sinh đăng nhập và tới `/lop-hoc`.
5. Admin khóa; reload trang học sinh và xác nhận bị chuyển tới trang khóa.
6. Admin kích hoạt lại, đặt lại mật khẩu; đăng nhập bằng mật khẩu tạm và xác
   nhận bắt buộc đổi mật khẩu trước khi vào `/lop-hoc`.
7. Nếu đã cấu hình Google, đăng nhập một email mới; nhập đủ hai SĐT, duyệt ở
   admin và xác nhận luồng giống học sinh Credentials.

Khi dev server đang chạy, có thể tự động kiểm tra các trạng thái cốt lõi bằng:

```bash
npm run verify:slice-0
```

Script tạo một học sinh test riêng, kiểm tra lỗi đăng nhập, quyền route và
redirect theo trạng thái, sau đó luôn xóa đúng user test vừa tạo.

Trước khi public vẫn cần rate limit đăng nhập và rà lại các mục chưa hoàn tất
trong `docs/security.md`.
