#!/usr/bin/env bash

set -Eeuo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-bqd-math-507809}"
GCP_REGION="${GCP_REGION:-asia-southeast1}"
SERVICE_NAME="${SERVICE_NAME:-bqdmath-web}"
RUNTIME_SA="bqdmath-runtime@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

section() {
  printf '\n\033[1;34m==> %s\033[0m\n' "$1"
}

fail() {
  printf '\nLỗi: %s\n' "$1" >&2
  exit 1
}

for command_name in gcloud curl jq; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Thiếu lệnh $command_name."
done

section "Bật Vertex AI và cấp quyền cho Cloud Run"
gcloud config set project "$GCP_PROJECT_ID" >/dev/null
gcloud iam service-accounts describe "$RUNTIME_SA" \
  --project="$GCP_PROJECT_ID" >/dev/null 2>&1 \
  || fail "Không tìm thấy service account $RUNTIME_SA."

gcloud services enable aiplatform.googleapis.com \
  --project="$GCP_PROJECT_ID"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/aiplatform.user" >/dev/null

section "Build và deploy phiên bản dùng Vertex AI"
gcloud builds submit \
  --project="$GCP_PROJECT_ID" \
  --config=cloudbuild.yaml \
  .

# Biến cũ không còn được ứng dụng dùng. Xóa binding khỏi revision mới sau khi
# deploy thành công; secret trong Secret Manager được giữ lại để có thể rollback.
gcloud run services update "$SERVICE_NAME" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --remove-secrets=GEMINI_API_KEY >/dev/null 2>&1 || true

APP_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --format=json \
  | jq -r '[.spec.template.spec.containers[0].env[]? | select(.name == "AUTH_URL") | .value][0] // .status.url')"

section "Kiểm tra website"
curl --fail --show-error --silent --max-time 120 "$APP_URL/api/health"
printf '\n\nĐã chuyển production sang Vertex AI Gemini: %s\n' "$APP_URL"
printf 'Model: gemini-3.1-flash-lite (location global)\n'
printf 'Xác thực: service account %s, không dùng Gemini API key.\n' "$RUNTIME_SA"
