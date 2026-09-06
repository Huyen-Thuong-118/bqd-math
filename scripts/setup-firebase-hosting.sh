#!/usr/bin/env bash

set -Eeuo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-bqd-math-507809}"
GCP_REGION="${GCP_REGION:-asia-southeast1}"
SERVICE_NAME="${SERVICE_NAME:-bqdmath-web}"
GCS_BUCKET="${GCS_BUCKET:-bqd-math-507809-bqdmath-files}"
REQUESTED_SITE_ID="${FIREBASE_SITE_ID:-}"
FIREBASE_CONFIG=""
CORS_FILE=""

cleanup() {
  [[ -z "$FIREBASE_CONFIG" || ! -f "$FIREBASE_CONFIG" ]] || rm -f "$FIREBASE_CONFIG"
  [[ -z "$CORS_FILE" || ! -f "$CORS_FILE" ]] || rm -f "$CORS_FILE"
}
trap cleanup EXIT

section() {
  printf '\n\033[1;34m==> %s\033[0m\n' "$1"
}

fail() {
  printf '\nLỗi: %s\n' "$1" >&2
  exit 1
}

for command_name in gcloud firebase jq curl; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Thiếu lệnh $command_name trong Cloud Shell."
done

section "Kiểm tra Cloud Run"
gcloud config set project "$GCP_PROJECT_ID" >/dev/null
gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" >/dev/null 2>&1 \
  || fail "Không tìm thấy Cloud Run service $SERVICE_NAME tại $GCP_REGION."

CLOUD_RUN_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --format='value(status.url)')"

section "Bật Firebase Hosting"
gcloud services enable \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  --project="$GCP_PROJECT_ID"

if ! firebase projects:list --json 2>/dev/null \
  | jq -e --arg project_id "$GCP_PROJECT_ID" \
      '.result[]? | select(.projectId == $project_id)' >/dev/null; then
  firebase projects:addfirebase "$GCP_PROJECT_ID"
fi

section "Tạo địa chỉ web ngắn"
if [[ -n "$REQUESTED_SITE_ID" ]]; then
  SITE_CANDIDATES=("$REQUESTED_SITE_ID")
else
  SITE_CANDIDATES=(bqdmath bqdmath-vn bqdmath-app)
fi

FIREBASE_SITE_ID=""
for candidate in "${SITE_CANDIDATES[@]}"; do
  if firebase hosting:sites:get "$candidate" \
    --project="$GCP_PROJECT_ID" >/dev/null 2>&1; then
    FIREBASE_SITE_ID="$candidate"
    break
  fi

  if firebase hosting:sites:create "$candidate" \
    --project="$GCP_PROJECT_ID" >/dev/null 2>&1; then
    FIREBASE_SITE_ID="$candidate"
    break
  fi
done

[[ -n "$FIREBASE_SITE_ID" ]] \
  || fail "Các tên bqdmath, bqdmath-vn và bqdmath-app đều đã được sử dụng. Chạy lại với FIREBASE_SITE_ID=tên-bạn-muốn."

PUBLIC_APP_URL="https://${FIREBASE_SITE_ID}.web.app"
printf 'Địa chỉ được chọn: %s\n' "$PUBLIC_APP_URL"

section "Nối Firebase Hosting với Cloud Run"
FIREBASE_CONFIG="$(mktemp)"
jq --arg site "$FIREBASE_SITE_ID" '.hosting.site = $site' \
  firebase.json > "$FIREBASE_CONFIG"

firebase deploy \
  --only hosting \
  --project="$GCP_PROJECT_ID" \
  --config="$FIREBASE_CONFIG" \
  --non-interactive

section "Cập nhật URL đăng nhập"
gcloud run services update "$SERVICE_NAME" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --update-env-vars="AUTH_URL=$PUBLIC_APP_URL,NEXTAUTH_URL=$PUBLIC_APP_URL" >/dev/null

section "Cập nhật CORS cho file tải lên"
CORS_FILE="$(mktemp)"
jq -n \
  --arg public_origin "$PUBLIC_APP_URL" \
  --arg cloud_run_origin "$CLOUD_RUN_URL" \
  '[{
    origin: [$public_origin, $cloud_run_origin],
    method: ["GET", "HEAD", "PUT"],
    responseHeader: ["Content-Type"],
    maxAgeSeconds: 3600
  }]' > "$CORS_FILE"

gcloud storage buckets update "gs://$GCS_BUCKET" \
  --cors-file="$CORS_FILE" >/dev/null

section "Kiểm tra địa chỉ mới"
curl --fail --show-error --silent --max-time 120 \
  "$PUBLIC_APP_URL/api/health"

printf '\n\nFirebase Hosting đã hoạt động: %s\n' "$PUBLIC_APP_URL"
printf 'Cloud Run gốc vẫn hoạt động:       %s\n' "$CLOUD_RUN_URL"
printf '\nGoogle Login cần thêm thủ công hai giá trị sau:\n'
printf 'Authorized JavaScript origin: %s\n' "$PUBLIC_APP_URL"
printf 'Authorized redirect URI:      %s/api/auth/callback/google\n' "$PUBLIC_APP_URL"
