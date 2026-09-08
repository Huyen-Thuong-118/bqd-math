# BQD Math

Ứng dụng ôn luyện và thi thử Toán: quản lý lớp, học sinh, tài liệu, ngân hàng câu hỏi và đề thi.

## Chạy trên Windows — bắt đầu ở đây

Dùng **PowerShell** hoặc terminal PowerShell trong VS Code cho toàn bộ lệnh bên dưới. Chạy lần lượt từng bước; nếu có lỗi thì xử lý trước khi sang bước tiếp theo.

### 1. Cài công cụ (chỉ lần đầu)

| Công cụ | Cần cài |
| --- | --- |
| [Git for Windows](https://git-scm.com/install/windows) | Để clone/pull code từ GitHub |
| [Node.js](https://nodejs.org/en/download) | Chọn **22.x, từ 22.12 trở lên**, bản Windows Installer; npm đi kèm |
| [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) | Dùng WSL 2 backend và Linux containers để chạy PostgreSQL + OCR |

Nếu Docker yêu cầu WSL, làm theo hướng dẫn trong trình cài đặt và khởi động lại máy khi được yêu cầu. Không cần cài PostgreSQL, Python hay Tesseract riêng.

Cài xong, **đóng rồi mở lại PowerShell**, mở **Docker Desktop** và chờ engine chạy. Kiểm tra:

```powershell
git --version
node --version
npm.cmd --version
docker compose version
docker info
```

README dùng `npm.cmd` để tránh lỗi PowerShell chặn `npm.ps1`; không cần đổi Execution Policy.

### 2. Lấy code về máy

Mở PowerShell tại thư mục muốn chứa dự án rồi chạy:

```powershell
git clone https://github.com/Huyen-Thuong-118/bqd-math.git
cd bqd-math
```

Nếu repo riêng tư, tài khoản GitHub của bạn cần được cấp quyền truy cập. Nếu đã clone rồi, mở thư mục đó và dùng `git pull`.

**Từ đây, chạy mọi lệnh trong thư mục có `package.json`.** Không copy `node_modules`, `.next` hoặc `.env` từ máy khác.

### 3. Tạo cấu hình local (chỉ lần đầu)

Copy nguyên khối dưới đây vào PowerShell. Lệnh tạo `.env` từ mẫu và tự sinh secret bằng Node.js; nếu `.env` đã tồn tại thì giữ nguyên.

```powershell
@'
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const os = require('node:os');
if (fs.existsSync('.env')) {
  console.log('Da co .env, giu nguyen cau hinh.');
} else {
  let env = fs.readFileSync('.env.example', 'utf8');
  const authSecret = crypto.randomBytes(32).toString('base64');
  for (const key of ['AUTH_SECRET', 'NEXTAUTH_SECRET', 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', 'RESET_TOKEN_SECRET', 'CRON_SECRET']) {
    const value = key === 'AUTH_SECRET' || key === 'NEXTAUTH_SECRET' ? authSecret : crypto.randomBytes(32).toString('base64');
    env = env.replace(new RegExp('^' + key + '=.*$', 'm'), key + '=' + value);
  }
  const gcloudDir = path.join(os.homedir(), '.config', 'gcloud');
  fs.mkdirSync(gcloudDir, { recursive: true });
  env += '\nBQDMATH_GCLOUD_CONFIG_DIR=' + JSON.stringify(gcloudDir.replaceAll('\\', '/')) + '\n';
  fs.writeFileSync('.env', env);
  console.log('Da tao .env va secret local.');
}
'@ | node
```

Giữ cấu hình database/local có sẵn trong `.env.example`. Thư mục `gcloud` rỗng được tạo để Docker mount được trên Windows; bước này không cần đăng nhập Google.

**Tạo `.env` trước khi cài dependencies** vì Prisma đọc cấu hình ngay trong bước cài đặt. File `.env` đã được Git bỏ qua, không commit file này.

### 4. Cài và khởi động

Chạy **từng dòng**, chỉ sang dòng kế tiếp khi dòng trước thành công:

```powershell
npm.cmd ci
npm.cmd run db:up
npm.cmd run db:migrate:deploy
npm.cmd run seed
npm.cmd run dev
```

Lần đầu Docker cần tải và build OCR nên có thể mất vài phút. Khi terminal báo server đã sẵn sàng, mở **[http://localhost:3000](http://localhost:3000)**. Giữ terminal đang chạy để sử dụng app.

Đăng nhập tại [http://localhost:3000/dang-nhap](http://localhost:3000/dang-nhap):

| Trường | Giá trị local mặc định |
| --- | --- |
| Tài khoản (email) | `admin@bqdmath.local` |
| Mật khẩu | `BqdMathDev123!` |

Email và mật khẩu lấy từ `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` trong `.env`. Đây là tài khoản thử nghiệm trên máy cá nhân. Muốn đổi thông tin, sửa nhóm `SEED_ADMIN_*` rồi chạy lại `npm.cmd run seed`; lệnh seed cũng đặt lại mật khẩu admin theo cấu hình đó.

### 5. Những lần chạy sau

Mở Docker Desktop, mở PowerShell trong thư mục dự án, chạy:

```powershell
npm.cmd run db:up
npm.cmd run dev
```

Dừng app bằng **Ctrl+C**. Muốn dừng cả database và OCR:

```powershell
npm.cmd run db:stop
```

Dữ liệu vẫn được giữ khi dừng dịch vụ hoặc khởi động lại máy.

### 6. Cập nhật code mới từ GitHub

Dừng dev server bằng **Ctrl+C**, mở Docker Desktop, rồi chạy từng dòng:

```powershell
git pull
npm.cmd ci
npm.cmd run db:up -- --build
npm.cmd run db:migrate:deploy
npm.cmd run dev
```

`npm ci` cài đúng phiên bản trong lockfile và sinh lại Prisma Client. `--build` cập nhật OCR nếu code dịch vụ thay đổi. `db:migrate:deploy` áp dụng migration đã có trong repo; không dùng `db:migrate` cho thao tác cập nhật thông thường.

Không cần seed lại mỗi lần pull. Nếu `.env.example` có biến mới, bổ sung biến đó vào `.env`, giữ secret và cấu hình hiện tại. Nếu `git pull` báo xung đột với thay đổi của bạn, lưu/commit thay đổi trước khi pull lại.

## Dữ liệu và tính năng tùy chọn

- Mỗi máy có database riêng trong Docker volume. `git pull` chỉ lấy code, không lấy tài khoản, lớp hay đề thi từ máy khác.
- PDF upload nằm ở `storage/uploads/`; database nằm trong Docker volume. Dừng container vẫn giữ dữ liệu; không chạy `docker compose down -v` nếu muốn giữ database.
- Cấu hình mẫu dùng database và file local. Không dùng `.env` production để chạy thử trên máy khác.
- Đăng nhập admin và OCR local không cần API key. Google login, gửi email, video Cloudflare và Vertex AI cần cấu hình dịch vụ tương ứng.

### Thêm dữ liệu demo

Sửa `.env` thành `SEED_DEMO_DATA="true"`, sau đó chạy:

```powershell
npm.cmd run seed
```

Lệnh tạo một học sinh, một lớp và một đề 10 câu. Học sinh mặc định đăng nhập bằng `0911111111`, mật khẩu `BqdMathStudent123!`. Sau khi tạo xong, có thể đặt lại `SEED_DEMO_DATA="false"` để các lần seed sau chỉ cập nhật admin.

### Google login và Vertex AI

Để bật Google login, điền `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` trong `.env`. OAuth client loại Web application dùng origin `http://localhost:3000` và redirect URI `http://localhost:3000/api/auth/callback/google`. Khởi động lại app sau khi sửa `.env`; xem thêm [tài liệu xác thực](docs/implementation-slice-0.md).

Vertex AI là tùy chọn, cần quyền truy cập Google Cloud project, billing và Application Default Credentials (ADC). Script `setup:local:vertex` hiện viết bằng Bash. Hướng dẫn Windows phía trên chỉ thiết lập OCR local; xem [tài liệu Google Cloud](docs/gcp-cloud-run-deployment.md) khi cần cấu hình AI nâng cao.

## Lỗi thường gặp trên Windows

| Lỗi | Cách xử lý |
| --- | --- |
| `npm.ps1 cannot be loaded` / `running scripts is disabled` | Dùng `npm.cmd` như hướng dẫn ở trên. |
| Không nhận `git`, `node`, `npm.cmd` hoặc `docker` | Cài công cụ tương ứng rồi mở lại terminal; kiểm tra bước 1. |
| Không kết nối được Docker / lỗi named pipe | Mở Docker Desktop, chờ engine chạy rồi thử `docker info`. |
| Docker báo thiếu WSL/virtualization | Làm theo [hướng dẫn Windows của Docker](https://docs.docker.com/desktop/setup/install/windows-install/), bật virtualization nếu được yêu cầu và restart máy. |
| `bash`, `nc`, `perl` hoặc `openssl` không tồn tại | Bạn đang dùng script `npm run local` dành cho môi trường Bash. Trên Windows dùng các bước PowerShell phía trên. |
| Thiếu `DIRECT_URL` hoặc `AUTH_SECRET` | Kiểm tra có `.env` trong thư mục `package.json` và đã chạy bước 3. Bước 3 không sửa `.env` cũ. |
| Docker báo đường dẫn mount `gcloud` không hợp lệ | Kiểm tra `BQDMATH_GCLOUD_CONFIG_DIR` trong `.env` trỏ tới thư mục có thật, dùng dấu `/`, ví dụ `"C:/Users/YourName/.config/gcloud"`. |
| Cổng `5432` hoặc `8001` đã được sử dụng | Dừng PostgreSQL/OCR hoặc container khác đang chiếm cổng, rồi chạy lại `npm.cmd run db:up`. |
| Prisma `P1001` / không kết nối được database | Chạy `npm.cmd run db:up`, kiểm tra Docker và hai URL database trong `.env.example`. |
| Prisma báo thiếu bảng/cột | Sau khi pull, chạy `npm.cmd ci` rồi `npm.cmd run db:migrate:deploy`. |
| Sai mật khẩu admin | Kiểm tra `SEED_ADMIN_*` trong `.env`, chạy `npm.cmd run seed` rồi đăng nhập lại. |
| App tự chuyển sang cổng `3001` | Dừng app đang chiếm cổng `3000` rồi chạy lại để khớp URL xác thực local. |

Xem trạng thái và log dịch vụ khi cần:

```powershell
docker compose -f infra/docker-compose.yml --project-directory . ps
docker compose -f infra/docker-compose.yml --project-directory . logs --tail 100 postgres ocr
```

## macOS / Linux

Script tự động hiện có cần Node.js, Docker, Bash, `curl`, `nc`, `openssl` và `perl`. Mở Docker trước rồi chạy:

```bash
npm run local
```

Script tạo `.env` nếu chưa có, cài dependencies nếu chưa có `node_modules`, khởi động dịch vụ và áp dụng migration. Nó luôn dùng database và lưu trữ local. Khi cần tài khoản admin, mở terminal thứ hai trong dự án và chạy `npm run seed` với cấu hình local. Sau khi pull có thay đổi dependencies, chạy `npm ci` trước khi chạy lại script.

## Công nghệ và tài liệu phát triển

Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / Prisma 7 / PostgreSQL 16 / Auth.js v5. OCR chạy trong Docker với Python, PyMuPDF và Tesseract.

| Thư mục | Nội dung |
| --- | --- |
| `src/app/` | Routing, layout và API routes |
| `src/features/` | Logic nghiệp vụ theo tính năng |
| `src/components/` | UI dùng chung |
| `src/lib/` | Database, auth, lưu trữ và tiện ích |
| `prisma/` | Schema, migrations, seed |
| `services/ocr/` | Dịch vụ OCR và nhập câu hỏi |
| `infra/` | Docker Compose local |
| `docs/` | Tài liệu kỹ thuật |

| Lệnh | Mục đích |
| --- | --- |
| `npm.cmd run db:studio` | Xem/sửa dữ liệu local bằng Prisma Studio |
| `npm.cmd run db:migrate` | Dành cho người sửa schema: tạo migration mới |
| `npm.cmd run lint` | Kiểm tra code bằng ESLint |
| `npm.cmd run build` | Build production để kiểm tra trước khi deploy |
| `npm.cmd run seed:samples` | Import đề mẫu, cần các PDF tương ứng trong `data/` |

- [Kiến trúc](docs/architecture.md) · [Phạm vi sản phẩm](docs/product-blueprint.md) · [Backlog](docs/implementation-agent-backlog.md)
- [Xác thực](docs/implementation-slice-0.md) · [Luồng thi và chấm điểm](docs/implementation-slice-1.md) · [Upload PDF](docs/implementation-slice-2.md)
- [Bảo mật](docs/security.md) · [Checklist production](docs/production-deployment.md) · [Deploy Google Cloud Run](docs/gcp-cloud-run-deployment.md)
