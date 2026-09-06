# Deploy BQD Math hoàn toàn trên Google Cloud

Kiến trúc production:

- Cloud Run chạy ứng dụng Next.js.
- Cloud SQL for PostgreSQL giữ dữ liệu.
- Cloud Storage giữ PDF/tài liệu trong bucket private.
- Artifact Registry giữ image; Cloud Build migrate, build và deploy.
- Vertex AI Gemini dùng IAM của Cloud Run, không cần Gemini API key.
- Secret Manager giữ mật khẩu và API key Resend; không tạo JSON service-account key.

## Cách nhanh: chạy toàn bộ phần còn lại một lần

Sau khi Cloud SQL, database, `db-password`, bucket, Artifact Registry và
`bqdmath-runtime` đã được tạo như bên dưới, chỉ cần:

```bash
cd ~/bqd-math
git pull
bash scripts/deploy-gcp-production.sh
```

Script tự cấp IAM, tạo các khóa ngẫu nhiên còn thiếu, migration, seed ADMIN,
build/deploy, cấu hình Auth URL, Google Login tùy chọn, CORS và Cloud Scheduler.
Script chỉ hỏi các giá trị nó không thể tự sinh: Resend API key/email gửi,
thông tin ADMIN và Google OAuth Client ID/Secret. Nếu bước nào
lỗi, script dừng ngay và có thể chạy lại an toàn; các tài nguyên/secret đã tạo
sẽ được tái sử dụng.

Các mục tiếp theo giải thích từng bước mà script thực hiện.

Các tên mặc định trong repo khớp project hiện tại:

```bash
export GCP_PROJECT_ID="bqd-math-507809"
export GCP_REGION="asia-southeast1"
export SQL_INSTANCE="bqdmath-postgres"
export DB_NAME="bqdmath"
export DB_USER="bqdmath"
export GCS_BUCKET="bqd-math-507809-bqdmath-files"
export RUNTIME_SA="bqdmath-runtime@$GCP_PROJECT_ID.iam.gserviceaccount.com"

gcloud config set project "$GCP_PROJECT_ID"
```

## 1. Bật API

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  aiplatform.googleapis.com \
  iamcredentials.googleapis.com \
  cloudscheduler.googleapis.com
```

Artifact Registry `bqdmath` và service account `bqdmath-runtime` chỉ cần tạo
một lần. Nếu đã có thì không chạy lại lệnh create.

## 2. Tạo Cloud SQL PostgreSQL

Cấu hình dưới đây là cấu hình khởi đầu cho production nhỏ: một zone, 1 vCPU,
3.75 GiB RAM, backup và point-in-time recovery. `db-f1-micro` rẻ hơn nhưng là
shared-core, không có SLA và dễ thiếu tài nguyên khi thi đông.

```bash
gcloud sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_16 \
  --edition=ENTERPRISE \
  --region="$GCP_REGION" \
  --tier=db-custom-1-3840 \
  --availability-type=ZONAL \
  --storage-type=SSD \
  --storage-size=10 \
  --storage-auto-increase \
  --backup-start-time=18:00 \
  --enable-point-in-time-recovery \
  --retained-backups-count=7 \
  --retained-transaction-log-days=7
```

Tạo database, user và lưu mật khẩu thẳng vào Secret Manager:

```bash
export GENERATED_DB_PASSWORD="$(openssl rand -base64 36 | tr -d '\n')"

gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"
gcloud sql users create "$DB_USER" \
  --instance="$SQL_INSTANCE" \
  --password="$GENERATED_DB_PASSWORD"

printf '%s' "$GENERATED_DB_PASSWORD" | \
  gcloud secrets create db-password --data-file=-

unset GENERATED_DB_PASSWORD
```

Nếu `db-password` đã tồn tại và cần cập nhật, dùng
`gcloud secrets versions add db-password --data-file=-` thay cho `create`.

## 3. Tạo Cloud Storage private bucket

```bash
gcloud storage buckets create "gs://$GCS_BUCKET" \
  --location="$GCP_REGION" \
  --uniform-bucket-level-access \
  --public-access-prevention
```

File không public. Ứng dụng tạo signed URL 5 phút để học sinh/giáo viên có
quyền mới được đọc hoặc upload.

## 4. Tạo các secret ứng dụng

Các secret bắt buộc trong pipeline:

- `db-password`
- `auth-secret`, `next-server-actions-key`, `reset-token-secret`, `cron-secret`
- `resend-api-key`, `email-from`

Bốn khóa ngẫu nhiên phải khác nhau. Ví dụ tạo một secret ngẫu nhiên:

```bash
openssl rand -base64 32 | gcloud secrets create auth-secret --data-file=-
```

`email-from` là chuỗi như `BQD Math <noreply@tenmien.vn>`. Không lưu secret
trong Git, ảnh chụp hoặc file JSON key.

## 5. Cấp IAM

```bash
export BUILD_SA="$(gcloud builds get-default-service-account)"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/aiplatform.user"

gcloud storage buckets add-iam-policy-binding "gs://$GCS_BUCKET" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/storage.objectAdmin"

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/iam.serviceAccountTokenCreator"

for SECRET_ID in db-password auth-secret next-server-actions-key \
  resend-api-key email-from reset-token-secret cron-secret; do
  gcloud secrets add-iam-policy-binding "$SECRET_ID" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="roles/secretmanager.secretAccessor"
done
```

Cloud Build cần migrate Cloud SQL, push image, deploy và gắn runtime service
account:

```bash
for ROLE in roles/cloudsql.client roles/artifactregistry.writer \
  roles/run.admin roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:$BUILD_SA" \
    --role="$ROLE"
done

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$BUILD_SA" \
  --role="roles/iam.serviceAccountUser"

for SECRET_ID in db-password next-server-actions-key; do
  gcloud secrets add-iam-policy-binding "$SECRET_ID" \
    --member="serviceAccount:$BUILD_SA" \
    --role="roles/secretmanager.secretAccessor"
done
```

## 6. Migration và deploy

```bash
gcloud builds submit --config cloudbuild.migrate.yaml .
gcloud builds submit --config cloudbuild.yaml .
```

Migration dùng Cloud SQL Auth Proxy trong Cloud Build. Cloud Run dùng Unix
socket `/cloudsql/PROJECT:REGION:INSTANCE`; database không cần allowlist IP.

Lấy URL service và cấu hình Auth.js:

```bash
export APP_URL="$(gcloud run services describe bqdmath-web \
  --region="$GCP_REGION" --format='value(status.url)')"

gcloud run services update bqdmath-web \
  --region="$GCP_REGION" \
  --update-env-vars="AUTH_URL=$APP_URL,NEXTAUTH_URL=$APP_URL"

echo "$APP_URL"
```

## 7. Cấu hình CORS cho upload trực tiếp

Sau khi có `$APP_URL`:

```bash
jq -n --arg origin "$APP_URL" '[{
  origin: [$origin],
  method: ["GET", "HEAD", "PUT"],
  responseHeader: ["Content-Type"],
  maxAgeSeconds: 3600
}]' > /tmp/bqdmath-gcs-cors.json

gcloud storage buckets update "gs://$GCS_BUCKET" \
  --cors-file=/tmp/bqdmath-gcs-cors.json
```

Khi thêm domain riêng, thêm cả domain đó vào mảng `origin` rồi apply lại.

## 8. Tạo ADMIN production

Nhập thông tin bằng prompt để mật khẩu không nằm trong shell history:

```bash
read -r -p "Email ADMIN: " SEED_ADMIN_EMAIL_VALUE
read -r -p "Số điện thoại ADMIN: " SEED_ADMIN_PHONE_VALUE
read -r -s -p "Mật khẩu ADMIN mạnh: " SEED_ADMIN_PASSWORD_VALUE
echo

printf '%s' "$SEED_ADMIN_EMAIL_VALUE" | \
  gcloud secrets create seed-admin-email --data-file=-
printf '%s' "$SEED_ADMIN_PHONE_VALUE" | \
  gcloud secrets create seed-admin-phone --data-file=-
printf '%s' "$SEED_ADMIN_PASSWORD_VALUE" | \
  gcloud secrets create seed-admin-password --data-file=-

unset SEED_ADMIN_EMAIL_VALUE SEED_ADMIN_PHONE_VALUE SEED_ADMIN_PASSWORD_VALUE

for SECRET_ID in seed-admin-email seed-admin-phone seed-admin-password; do
  gcloud secrets add-iam-policy-binding "$SECRET_ID" \
    --member="serviceAccount:$BUILD_SA" \
    --role="roles/secretmanager.secretAccessor"
done

gcloud builds submit --config cloudbuild.seed-admin.yaml .
```

Job này upsert đúng ADMIN, ép `SEED_DEMO_DATA=false` và không đưa database
password về laptop. Không chạy `seed:test-data` trên production.

## 9. Kiểm tra và các lần deploy sau

```bash
curl --fail --show-error "$APP_URL/api/health"
gcloud run services logs read bqdmath-web \
  --region="$GCP_REGION" --limit=100
```

Nếu có Prisma migration mới, chạy migration trước; sau đó deploy web:

```bash
gcloud builds submit --config cloudbuild.migrate.yaml .
gcloud builds submit --config cloudbuild.yaml .
```

Cloud SQL là chi phí nền lớn nhất. Bật Billing budget/alert. Có thể giảm xuống
`db-f1-micro` khi chỉ thử nội bộ, nhưng production có người dùng thật nên giữ
cấu hình custom bên trên và theo dõi CPU/RAM trước khi giảm.

## Lỗi thường gặp

- `Cloud SQL Admin API` hoặc `Cloud SQL Client` thiếu: migration/app không kết nối DB.
- `iam.serviceAccounts.signBlob denied`: runtime thiếu Service Account Token Creator trên chính nó.
- Upload bị CORS: origin trong bucket chưa đúng chính xác URL đang mở.
- Cloud Build `actAs denied`: build account thiếu Service Account User trên runtime account.
- Revision trả 500: xem Cloud Run logs và kiểm tra `db-password`, tên database/user.
