#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
GCP_PROJECT_ID="${GCP_PROJECT_ID:-bqd-math-507809}"
GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-global}"

section() {
  printf '\n\033[1;34m==> %s\033[0m\n' "$1"
}

fail() {
  printf '\nLỗi: %s\n' "$1" >&2
  exit 1
}

upsert_env() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "$ENV_FILE"; then
    ENV_KEY="$key" ENV_VALUE="$value" perl -0pi -e '
      s/^\Q$ENV{ENV_KEY}\E=.*$/$ENV{ENV_KEY}="$ENV{ENV_VALUE}"/m;
    ' "$ENV_FILE"
  else
    printf '\n%s="%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

command -v gcloud >/dev/null 2>&1 \
  || fail "Chưa cài Google Cloud CLI. Cài theo https://cloud.google.com/sdk/docs/install rồi chạy lại."
command -v perl >/dev/null 2>&1 \
  || fail "Thiếu lệnh perl để cập nhật file .env."

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
  printf 'Đã tạo .env từ .env.example.\n'
fi

section "Đăng nhập Google Cloud CLI"
if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' \
  | grep -q .; then
  gcloud auth login
fi

gcloud config set project "$GCP_PROJECT_ID" >/dev/null

section "Bật Vertex AI API"
gcloud services enable aiplatform.googleapis.com \
  --project="$GCP_PROJECT_ID"

section "Tạo Application Default Credentials cho local"
if gcloud auth application-default print-access-token >/dev/null 2>&1; then
  printf 'ADC đã tồn tại, không cần đăng nhập lại.\n'
else
  gcloud auth application-default login
fi
gcloud auth application-default set-quota-project "$GCP_PROJECT_ID"

gcloud auth application-default print-access-token >/dev/null 2>&1 \
  || fail "Không kiểm tra được ADC sau khi đăng nhập."

section "Cập nhật cấu hình Vertex AI cho app local"
upsert_env "GOOGLE_CLOUD_PROJECT" "$GCP_PROJECT_ID"
upsert_env "GOOGLE_CLOUD_LOCATION" "$GOOGLE_CLOUD_LOCATION"

section "Kiểm tra billing cho Vertex AI"
BILLING_ENABLED="$(gcloud billing projects describe "$GCP_PROJECT_ID" \
  --format='value(billingEnabled)' 2>/dev/null || true)"
if [[ "$BILLING_ENABLED" == "False" || "$BILLING_ENABLED" == "false" ]]; then
  fail "Project $GCP_PROJECT_ID chưa bật billing. Liên kết billing tại https://console.cloud.google.com/billing/linkedaccount?project=$GCP_PROJECT_ID rồi chạy lại lệnh này."
fi
if [[ -z "$BILLING_ENABLED" ]]; then
  printf 'Cảnh báo: không kiểm tra được billing; nếu Vertex trả BILLING_DISABLED, hãy liên kết billing cho project.\n' >&2
fi

printf '\nVertex AI local đã được cấu hình cho project %s.\n' "$GCP_PROJECT_ID"
printf 'Location: %s.\n' "$GOOGLE_CLOUD_LOCATION"
printf 'Tài khoản đăng nhập cần role Vertex AI User (roles/aiplatform.user).\n'
printf 'Chạy app bằng: npm run local\n'
