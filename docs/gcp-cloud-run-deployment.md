# Deploy BQD Math lên Google Cloud Run

Runbook này dùng cho môi trường production, không phải bản demo tạm:

- **Cloud Run** chạy ứng dụng Next.js tại Singapore (`asia-southeast1`).
- **Artifact Registry** giữ container image bất biến theo từng build.
- **Cloud Build** build, push và tạo Cloud Run revision mới.
- **Secret Manager** giữ password, connection string và API key.
- **Cloud Scheduler** gọi tác vụ dọn tài khoản mỗi ngày.
- PostgreSQL vẫn dùng **Neon** và file PDF vẫn dùng **Cloudflare R2**, vì code
  hiện tại đã có pooler và upload trực tiếp cho hai dịch vụ này. Chuyển DB sang
  Cloud SQL hoặc file sang Cloud Storage là một migration khác, không bắt buộc
  để chạy ứng dụng trên GCP.

## 1. Tạo project và bật billing

1. Mở <https://console.cloud.google.com/projectcreate>.
2. Đặt tên `BQD Math Production` và chọn Project ID duy nhất, ví dụ
   `bqdmath-prod-2026`. **Project ID không đổi được sau khi tạo.**
3. Mở **Billing → My projects**, liên kết project với Billing Account.
4. Mở Cloud Shell bằng biểu tượng `>_` trên thanh trên cùng. Cloud Shell đã có
   `gcloud`; máy local chỉ cần cài Google Cloud CLI nếu không muốn dùng Cloud
   Shell.
5. Lấy code về Cloud Shell (repo private sẽ yêu cầu đăng nhập GitHub), hoặc chạy
   các lệnh dưới đây ngay tại repo trên máy local sau khi cài `gcloud`.

```bash
git clone https://github.com/Huyen-Thuong-118/Math_website.git bqd-math
cd bqd-math
```

Khai báo đúng Project ID vừa tạo:

```bash
export GCP_PROJECT_ID="bqdmath-prod-2026"
export GCP_REGION="asia-southeast1"
gcloud config set project "$GCP_PROJECT_ID"
gcloud config set run/region "$GCP_REGION"
gcloud config set builds/region global
```

## 2. Bật API và tạo tài nguyên nền

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com

gcloud artifacts repositories create bqdmath \
  --repository-format=docker \
  --location="$GCP_REGION" \
  --description="BQD Math production images"

gcloud iam service-accounts create bqdmath-runtime \
  --display-name="BQD Math Cloud Run runtime"
```

Nếu lệnh create báo resource đã tồn tại thì không tạo lại; tiếp tục bước sau.

## 3. Tạo các secret production

Vào **Security → Secret Manager → Create secret**. Tạo đúng các Secret ID sau;
không thêm dấu nháy vào value.

| Secret ID | Giá trị |
|---|---|
| `database-url` | Neon pooled `DATABASE_URL`, có `sslmode=require` |
| `direct-url` | Neon direct `DIRECT_URL`, có `sslmode=require` |
| `auth-secret` | Kết quả của `openssl rand -base64 32` |
| `next-server-actions-key` | Một kết quả khác của `openssl rand -base64 32` |
| `r2-account-id` | Cloudflare account ID |
| `r2-access-key-id` | R2 access key chỉ có quyền đúng bucket production |
| `r2-secret-access-key` | R2 secret key |
| `r2-bucket-name` | Tên private bucket production |
| `gemini-api-key` | Gemini API key phía server |
| `resend-api-key` | Resend API key |
| `email-from` | Ví dụ `BQD Math <noreply@bqdmath.edu.vn>`; domain phải verify |
| `reset-token-secret` | Một kết quả khác của `openssl rand -base64 32` |
| `cron-secret` | Một kết quả khác của `openssl rand -base64 32` |

Không dùng cùng một chuỗi cho `auth-secret`, `next-server-actions-key`,
`reset-token-secret` và `cron-secret`. Không đưa secret vào Git, ảnh chụp màn
hình hay nội dung chat.

Nếu dùng Google Login, tạo thêm `google-client-id` và `google-client-secret`;
sau lần deploy đầu sẽ gắn hai secret này vào Cloud Run ở bước 7.

## 4. Cấp quyền tối thiểu

Lấy service account thực sự Cloud Build đang dùng. Project mới có thể dùng
Compute Engine default service account thay vì tên Cloud Build kiểu cũ, vì vậy
không đoán email bằng tay:

```bash
export BUILD_SERVICE_ACCOUNT="$(gcloud builds get-default-service-account)"
export RUNTIME_SERVICE_ACCOUNT="bqdmath-runtime@$GCP_PROJECT_ID.iam.gserviceaccount.com"
echo "$BUILD_SERVICE_ACCOUNT"
```

Cho runtime chỉ đọc các secret mà web cần:

```bash
RUNTIME_SECRETS=(
  database-url auth-secret next-server-actions-key
  r2-account-id r2-access-key-id r2-secret-access-key r2-bucket-name
  gemini-api-key resend-api-key email-from reset-token-secret cron-secret
)

for SECRET_ID in "${RUNTIME_SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$SECRET_ID" \
    --member="serviceAccount:$RUNTIME_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"
done
```

Cho Cloud Build đẩy image, deploy revision, ghi log và chỉ đọc hai secret cần
cho build/migration:

```bash
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" \
  --role="roles/storage.admin"

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SERVICE_ACCOUNT" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" \
  --role="roles/iam.serviceAccountUser"

for SECRET_ID in direct-url next-server-actions-key; do
  gcloud secrets add-iam-policy-binding "$SECRET_ID" \
    --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"
done
```

## 5. Chạy migration rồi deploy

Migration là bước riêng để lỗi schema không bị che trong lúc rollout web:

```bash
gcloud builds submit --config cloudbuild.migrate.yaml .
gcloud builds submit --config cloudbuild.yaml .
```

`cloudbuild.yaml` sẽ:

1. build image Next.js standalone bằng khóa Server Actions từ Secret Manager;
2. push image gắn tag bằng Cloud Build ID;
3. tạo Cloud Run revision mới, chạy bằng user không phải root;
4. cấu hình 1 CPU, RAM 1 GiB, tối đa 10 instance và timeout 300 giây.

Lấy URL HTTPS ổn định của service:

```bash
export APP_URL="$(gcloud run services describe bqdmath-web \
  --region="$GCP_REGION" \
  --format='value(status.url)')"
echo "$APP_URL"
```

Gắn URL này cho Auth.js rồi tạo revision cấu hình mới:

```bash
gcloud run services update bqdmath-web \
  --region="$GCP_REGION" \
  --update-env-vars="AUTH_URL=$APP_URL,NEXTAUTH_URL=$APP_URL"
```

URL `run.app` là HTTPS production ổn định, có thể dùng ngay. Không dùng URL của
một revision cụ thể.

## 6. Tạo ADMIN đầu tiên

Trên máy tin cậy, tạo `.env.seed.production.local` chứa `DATABASE_URL`,
`DIRECT_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD`.
Sau đó chạy đúng một lần:

```bash
DOTENV_CONFIG_PATH=.env.seed.production.local npm run seed
```

Đăng nhập kiểm tra rồi xóa file này. Không chạy `seed:test-data` hoặc bật
`SEED_DEMO_DATA` trên database thật.

## 7. Google Login, R2 CORS và Cloud Scheduler

### Google Login (nếu dùng)

Trong Google OAuth Web Client, thêm:

- Authorized JavaScript origin: giá trị `$APP_URL`
- Authorized redirect URI: `$APP_URL/api/auth/callback/google`

Cấp runtime quyền đọc hai secret tùy chọn rồi gắn chúng vào service:

```bash
for SECRET_ID in google-client-id google-client-secret; do
  gcloud secrets add-iam-policy-binding "$SECRET_ID" \
    --member="serviceAccount:$RUNTIME_SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"
done

gcloud run services update bqdmath-web \
  --region="$GCP_REGION" \
  --update-secrets="GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest"
```

### R2 CORS

Allowed origin của bucket phải có đúng `$APP_URL`; method là `PUT` và header là
`Content-Type`. Bucket vẫn để private.

### Cleanup hằng ngày

Lấy cron secret vào biến tạm để giá trị thật không nằm trong shell history:

```bash
export CRON_VALUE="$(gcloud secrets versions access latest --secret=cron-secret)"

gcloud scheduler jobs create http cleanup-suspended-accounts \
  --location="$GCP_REGION" \
  --schedule="0 3 * * *" \
  --time-zone="Asia/Ho_Chi_Minh" \
  --uri="$APP_URL/api/cron/cleanup-suspended-accounts" \
  --http-method=GET \
  --headers="Authorization=Bearer $CRON_VALUE" \
  --attempt-deadline=300s

unset CRON_VALUE
```

Lịch trên là 03:00 mỗi ngày theo giờ Việt Nam. Chạy thử và xem lần thực thi:

```bash
gcloud scheduler jobs run cleanup-suspended-accounts --location="$GCP_REGION"
gcloud scheduler jobs describe cleanup-suspended-accounts --location="$GCP_REGION"
```

## 8. Kiểm tra trước khi mở cho học sinh

```bash
curl --fail --show-error "$APP_URL/api/health"
gcloud run services logs read bqdmath-web --region="$GCP_REGION" --limit=100
```

Sau đó làm đầy đủ smoke test trong [production-deployment.md](./production-deployment.md):
đăng nhập ADMIN/học sinh, duyệt lớp, lịch 2–3 buổi, thông báo, upload PDF R2,
làm/nộp/chấm bài, email OTP và kiểm tra phân quyền chéo.

## 9. Deploy các phiên bản sau

Trước khi deploy:

```bash
npm run lint
npm run build
```

Nếu commit có Prisma migration:

```bash
gcloud builds submit --config cloudbuild.migrate.yaml .
```

Mỗi lần phát hành web:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

Cloud Run giữ revision trước để rollback traffic nếu code mới có lỗi. Không
rollback migration database bằng cách rollback image; migration production phải
được thiết kế tương thích ngược và backup trước thay đổi lớn.

## 10. Domain riêng và kiểm soát chi phí

- Giai đoạn đầu có thể dùng URL `run.app` để tránh thêm chi phí cố định.
- Với domain production, Google khuyến nghị Global External Application Load
  Balancer. Cloud Run Domain Mapping tại Singapore vẫn ở Preview và Google ghi
  rõ không khuyến nghị cho production.
- Cấu hình Billing budget/alert ngay sau deploy. Budget chỉ cảnh báo, không tự
  tắt dịch vụ.
- `min-instances=0` là cấu hình tiết kiệm hiện tại. Trước buổi thi đông, có thể
  đổi lên `1` để giảm cold start; điều này làm tăng chi phí nền.
- Đặt giới hạn chi tiêu riêng ở Neon, Cloudflare, Gemini và Resend vì GCP Budget
  không theo dõi các dịch vụ ngoài Google.

## Xử lý lỗi thường gặp

- **Cloud Build không đọc được secret:** kiểm tra `BUILD_SERVICE_ACCOUNT` bằng
  `gcloud builds get-default-service-account` rồi cấp Secret Accessor đúng email.
- **Cloud Build deploy bị `actAs denied`:** thiếu Service Account User trên
  `bqdmath-runtime` cho build service account.
- **Revision không ready / container không listen:** xem Cloud Run logs; image
  đã được cấu hình `HOSTNAME=0.0.0.0` và `PORT=8080`, không sửa hai giá trị này.
- **Trang chủ trả 500 nhưng `/api/health` vẫn 200:** container đang chạy nhưng
  `DATABASE_URL` không kết nối được; kiểm tra Neon pooled URL/TLS và trạng thái DB.
- **Đăng nhập redirect sai:** `AUTH_URL`/`NEXTAUTH_URL` chưa trùng URL đang mở,
  hoặc Google OAuth callback chưa có `/api/auth/callback/google`.
- **Upload PDF lỗi CORS:** R2 AllowedOrigins thiếu URL chính xác, hoặc bucket/API
  token sai quyền.
- **Prisma P1001:** `direct-url` sai, DB đang sleep/firewall chặn, hoặc thiếu
  `sslmode=require`; migration không dùng pooled URL.
