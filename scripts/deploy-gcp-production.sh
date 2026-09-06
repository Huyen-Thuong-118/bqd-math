#!/usr/bin/env bash

set -Eeuo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-bqd-math-507809}"
GCP_REGION="${GCP_REGION:-asia-southeast1}"
SQL_INSTANCE="${SQL_INSTANCE:-bqdmath-postgres}"
GCS_BUCKET="${GCS_BUCKET:-bqd-math-507809-bqdmath-files}"
RUNTIME_SA="bqdmath-runtime@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
SERVICE_NAME="bqdmath-web"
SCHEDULER_JOB="cleanup-suspended-accounts"
CORS_FILE=""

cleanup() {
  if [[ -n "$CORS_FILE" && -f "$CORS_FILE" ]]; then
    rm -f "$CORS_FILE"
  fi
}
trap cleanup EXIT

section() {
  printf '\n\033[1;34m==> %s\033[0m\n' "$1"
}

fail() {
  printf '\nLỗi: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Thiếu lệnh $1."
}

secret_exists() {
  gcloud secrets describe "$1" --project="$GCP_PROJECT_ID" >/dev/null 2>&1
}

create_random_secret_if_missing() {
  local secret_id="$1"
  if secret_exists "$secret_id"; then
    printf 'Secret %-32s đã có.\n' "$secret_id"
    return
  fi

  openssl rand -base64 32 | gcloud secrets create "$secret_id" \
    --project="$GCP_PROJECT_ID" \
    --data-file=- >/dev/null
  printf 'Đã tạo secret %s.\n' "$secret_id"
}

prompt_secret_if_missing() {
  local secret_id="$1"
  local label="$2"
  local value=""

  if secret_exists "$secret_id"; then
    printf 'Secret %-32s đã có.\n' "$secret_id"
    return
  fi

  read -r -s -p "$label: " value
  printf '\n'
  [[ -n "$value" ]] || fail "$label không được để trống."
  printf '%s' "$value" | gcloud secrets create "$secret_id" \
    --project="$GCP_PROJECT_ID" \
    --data-file=- >/dev/null
  unset value
  printf 'Đã tạo secret %s.\n' "$secret_id"
}

prompt_text_if_missing() {
  local secret_id="$1"
  local label="$2"
  local value=""

  if secret_exists "$secret_id"; then
    printf 'Secret %-32s đã có.\n' "$secret_id"
    return
  fi

  read -r -p "$label: " value
  [[ -n "$value" ]] || fail "$label không được để trống."
  printf '%s' "$value" | gcloud secrets create "$secret_id" \
    --project="$GCP_PROJECT_ID" \
    --data-file=- >/dev/null
  unset value
  printf 'Đã tạo secret %s.\n' "$secret_id"
}

require_command gcloud
require_command openssl
require_command jq
require_command curl

section "Kiểm tra project và tài nguyên"
gcloud config set project "$GCP_PROJECT_ID" >/dev/null

gcloud sql instances describe "$SQL_INSTANCE" \
  --project="$GCP_PROJECT_ID" >/dev/null 2>&1 \
  || fail "Không tìm thấy Cloud SQL $SQL_INSTANCE."

SQL_STATE="$(gcloud sql instances describe "$SQL_INSTANCE" \
  --project="$GCP_PROJECT_ID" --format='value(state)')"
[[ "$SQL_STATE" == "RUNNABLE" ]] || fail "Cloud SQL đang ở trạng thái $SQL_STATE."

gcloud storage buckets describe "gs://$GCS_BUCKET" >/dev/null 2>&1 \
  || fail "Không tìm thấy bucket gs://$GCS_BUCKET."

gcloud artifacts repositories describe bqdmath \
  --project="$GCP_PROJECT_ID" --location="$GCP_REGION" >/dev/null 2>&1 \
  || fail "Không tìm thấy Artifact Registry bqdmath."

gcloud iam service-accounts describe "$RUNTIME_SA" \
  --project="$GCP_PROJECT_ID" >/dev/null 2>&1 \
  || fail "Không tìm thấy service account $RUNTIME_SA."

secret_exists db-password || fail "Không tìm thấy secret db-password."

BUILD_SA_RESOURCE="$(gcloud builds get-default-service-account \
  --project="$GCP_PROJECT_ID")"
BUILD_SA="${BUILD_SA_RESOURCE##*/}"
[[ "$BUILD_SA" == *"@"* ]] || fail "Không xác định được Cloud Build service account."

printf 'Project:     %s\n' "$GCP_PROJECT_ID"
printf 'Cloud SQL:   %s (%s)\n' "$SQL_INSTANCE" "$SQL_STATE"
printf 'Bucket:      gs://%s\n' "$GCS_BUCKET"
printf 'Runtime SA:  %s\n' "$RUNTIME_SA"
printf 'Build SA:    %s\n' "$BUILD_SA"

section "Bật các API cần thiết"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  iamcredentials.googleapis.com \
  cloudscheduler.googleapis.com \
  --project="$GCP_PROJECT_ID"

section "Tạo hoặc kiểm tra secret"
create_random_secret_if_missing auth-secret
create_random_secret_if_missing next-server-actions-key
create_random_secret_if_missing reset-token-secret
create_random_secret_if_missing cron-secret

prompt_secret_if_missing gemini-api-key "Dán Gemini API key"
prompt_secret_if_missing resend-api-key "Dán Resend API key"
prompt_text_if_missing email-from "Email gửi OTP, ví dụ BQD Math <noreply@tenmien.vn>"

prompt_text_if_missing seed-admin-email "Email đăng nhập ADMIN"
prompt_text_if_missing seed-admin-phone "Số điện thoại ADMIN"

if ! secret_exists seed-admin-password; then
  ADMIN_PASSWORD=""
  ADMIN_PASSWORD_CONFIRM=""
  read -r -s -p "Mật khẩu ADMIN mạnh: " ADMIN_PASSWORD
  printf '\n'
  read -r -s -p "Nhập lại mật khẩu ADMIN: " ADMIN_PASSWORD_CONFIRM
  printf '\n'
  [[ -n "$ADMIN_PASSWORD" ]] || fail "Mật khẩu ADMIN không được để trống."
  [[ "$ADMIN_PASSWORD" == "$ADMIN_PASSWORD_CONFIRM" ]] \
    || fail "Hai lần nhập mật khẩu ADMIN không khớp."
  printf '%s' "$ADMIN_PASSWORD" | gcloud secrets create seed-admin-password \
    --project="$GCP_PROJECT_ID" \
    --data-file=- >/dev/null
  unset ADMIN_PASSWORD ADMIN_PASSWORD_CONFIRM
  printf 'Đã tạo secret seed-admin-password.\n'
else
  printf 'Secret %-32s đã có.\n' seed-admin-password
fi

section "Cấp IAM tối thiểu"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/cloudsql.client" >/dev/null

gcloud storage buckets add-iam-policy-binding "gs://$GCS_BUCKET" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/storage.objectAdmin" >/dev/null

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/iam.serviceAccountTokenCreator" >/dev/null

for role in \
  roles/cloudsql.client \
  roles/artifactregistry.writer \
  roles/run.admin \
  roles/logging.logWriter
do
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:$BUILD_SA" \
    --role="$role" >/dev/null
done

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$BUILD_SA" \
  --role="roles/iam.serviceAccountUser" >/dev/null

RUNTIME_SECRETS=(
  db-password
  auth-secret
  next-server-actions-key
  gemini-api-key
  resend-api-key
  email-from
  reset-token-secret
  cron-secret
)
for secret_id in "${RUNTIME_SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$secret_id" \
    --project="$GCP_PROJECT_ID" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

BUILD_SECRETS=(
  db-password
  next-server-actions-key
  seed-admin-email
  seed-admin-phone
  seed-admin-password
)
for secret_id in "${BUILD_SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$secret_id" \
    --project="$GCP_PROJECT_ID" \
    --member="serviceAccount:$BUILD_SA" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

section "Chạy database migration"
gcloud builds submit \
  --project="$GCP_PROJECT_ID" \
  --config=cloudbuild.migrate.yaml \
  .

section "Tạo hoặc cập nhật ADMIN"
gcloud builds submit \
  --project="$GCP_PROJECT_ID" \
  --config=cloudbuild.seed-admin.yaml \
  .

section "Build image và deploy Cloud Run"
gcloud builds submit \
  --project="$GCP_PROJECT_ID" \
  --config=cloudbuild.yaml \
  .

CLOUD_RUN_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --format='value(status.url)')"
[[ "$CLOUD_RUN_URL" == https://* ]] || fail "Không lấy được URL Cloud Run."

EXISTING_AUTH_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --format=json \
  | jq -r '.spec.template.spec.containers[0].env[]? | select(.name == "AUTH_URL") | .value' \
  | head -n 1)"

if [[ -n "${PUBLIC_APP_URL:-}" ]]; then
  APP_URL="$PUBLIC_APP_URL"
elif [[ "$EXISTING_AUTH_URL" == https://*.web.app || "$EXISTING_AUTH_URL" == https://*.firebaseapp.com ]]; then
  APP_URL="$EXISTING_AUTH_URL"
else
  APP_URL="$CLOUD_RUN_URL"
fi

gcloud run services update "$SERVICE_NAME" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --update-env-vars="AUTH_URL=$APP_URL,NEXTAUTH_URL=$APP_URL" >/dev/null

section "Cấu hình Google Login"
CONFIGURE_GOOGLE="no"
if secret_exists google-client-id && secret_exists google-client-secret; then
  CONFIGURE_GOOGLE="yes"
  printf 'Đã có Google OAuth Client ID/Secret; sẽ gắn vào Cloud Run.\n'
else
  printf 'Cloud Run URL: %s\n' "$APP_URL"
  printf 'Authorized JavaScript origin: %s\n' "$APP_URL"
  printf 'Authorized redirect URI: %s/api/auth/callback/google\n' "$APP_URL"
  printf '\nTạo OAuth Client loại Web application tại:\n'
  printf 'https://console.cloud.google.com/auth/clients?project=%s\n\n' "$GCP_PROJECT_ID"

  GOOGLE_CHOICE=""
  read -r -p "Cấu hình Google Login ngay? [Y/n]: " GOOGLE_CHOICE
  GOOGLE_CHOICE="${GOOGLE_CHOICE:-Y}"
  if [[ "$GOOGLE_CHOICE" =~ ^[Yy]$ ]]; then
    read -r -p "Nhấn Enter sau khi đã tạo OAuth Client trong Google Cloud Console..."
    prompt_text_if_missing google-client-id "Google OAuth Client ID"
    prompt_secret_if_missing google-client-secret "Google OAuth Client Secret"
    CONFIGURE_GOOGLE="yes"
  else
    printf 'Bỏ qua Google Login; đăng nhập email/mật khẩu vẫn hoạt động.\n'
  fi
fi

if [[ "$CONFIGURE_GOOGLE" == "yes" ]]; then
  for secret_id in google-client-id google-client-secret; do
    gcloud secrets add-iam-policy-binding "$secret_id" \
      --project="$GCP_PROJECT_ID" \
      --member="serviceAccount:$RUNTIME_SA" \
      --role="roles/secretmanager.secretAccessor" >/dev/null
  done

  gcloud run services update "$SERVICE_NAME" \
    --project="$GCP_PROJECT_ID" \
    --region="$GCP_REGION" \
    --update-secrets="GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest" >/dev/null
fi

section "Cấu hình CORS cho Cloud Storage"
CORS_FILE="$(mktemp)"
jq -n --arg origin "$APP_URL" '[{
  origin: [$origin],
  method: ["GET", "HEAD", "PUT"],
  responseHeader: ["Content-Type"],
  maxAgeSeconds: 3600
}]' > "$CORS_FILE"

gcloud storage buckets update "gs://$GCS_BUCKET" \
  --cors-file="$CORS_FILE" >/dev/null

section "Tạo hoặc cập nhật lịch dọn tài khoản"
CRON_VALUE="$(gcloud secrets versions access latest \
  --project="$GCP_PROJECT_ID" --secret=cron-secret)"

if gcloud scheduler jobs describe "$SCHEDULER_JOB" \
  --project="$GCP_PROJECT_ID" --location="$GCP_REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$SCHEDULER_JOB" \
    --project="$GCP_PROJECT_ID" \
    --location="$GCP_REGION" \
    --schedule="0 3 * * *" \
    --time-zone="Asia/Ho_Chi_Minh" \
    --uri="$CLOUD_RUN_URL/api/cron/cleanup-suspended-accounts" \
    --http-method=GET \
    --update-headers="Authorization=Bearer $CRON_VALUE" >/dev/null
else
  gcloud scheduler jobs create http "$SCHEDULER_JOB" \
    --project="$GCP_PROJECT_ID" \
    --location="$GCP_REGION" \
    --schedule="0 3 * * *" \
    --time-zone="Asia/Ho_Chi_Minh" \
    --uri="$CLOUD_RUN_URL/api/cron/cleanup-suspended-accounts" \
    --http-method=GET \
    --headers="Authorization=Bearer $CRON_VALUE" >/dev/null
fi
unset CRON_VALUE

section "Kiểm tra website"
curl --fail --show-error --silent "$APP_URL/api/health"
printf '\n\nDeploy production thành công: %s\n' "$APP_URL"
if [[ "$APP_URL" != "$CLOUD_RUN_URL" ]]; then
  printf 'Cloud Run gốc: %s\n' "$CLOUD_RUN_URL"
fi
printf 'Đăng nhập bằng email và mật khẩu ADMIN vừa nhập.\n'
if [[ "$CONFIGURE_GOOGLE" == "yes" ]]; then
  printf 'Google Login đã được cấu hình trên Cloud Run.\n'
fi
