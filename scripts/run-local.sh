#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/infra/docker-compose.yml"

section() {
  printf '\n\033[1;34m==> %s\033[0m\n' "$1"
}

fail() {
  printf '\nLỗi: %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

postgres_is_available() {
  nc -z 127.0.0.1 5432 >/dev/null 2>&1
}

ocr_is_available() {
  curl --fail --silent --max-time 2 \
    http://127.0.0.1:8001/health >/dev/null 2>&1
}

initialize_env() {
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"

  local auth_secret
  local actions_key
  local reset_secret
  local cron_secret

  auth_secret="$(openssl rand -base64 32)"
  actions_key="$(openssl rand -base64 32)"
  reset_secret="$(openssl rand -base64 32)"
  cron_secret="$(openssl rand -base64 32)"

  AUTH_SECRET_VALUE="$auth_secret" \
  ACTIONS_KEY_VALUE="$actions_key" \
  RESET_SECRET_VALUE="$reset_secret" \
  CRON_SECRET_VALUE="$cron_secret" \
    perl -0pi -e '
      s/^NEXTAUTH_SECRET=""$/NEXTAUTH_SECRET="$ENV{AUTH_SECRET_VALUE}"/m;
      s/^AUTH_SECRET=""$/AUTH_SECRET="$ENV{AUTH_SECRET_VALUE}"/m;
      s/^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=""$/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$ENV{ACTIONS_KEY_VALUE}"/m;
      s/^RESET_TOKEN_SECRET=""$/RESET_TOKEN_SECRET="$ENV{RESET_SECRET_VALUE}"/m;
      s/^CRON_SECRET=""$/CRON_SECRET="$ENV{CRON_SECRET_VALUE}"/m;
    ' "$PROJECT_DIR/.env"

  printf 'Đã tạo .env từ .env.example và sinh các secret dùng cho local.\n'
}

for command_name in node npm docker curl nc; do
  command_exists "$command_name" || fail "Thiếu lệnh $command_name."
done

cd "$PROJECT_DIR"

if [[ ! -f .env ]]; then
  command_exists openssl || fail "Thiếu lệnh openssl để tạo secret local."
  command_exists perl || fail "Thiếu lệnh perl để cập nhật file .env."
  section "Khởi tạo môi trường local"
  initialize_env
fi

if [[ ! -d node_modules ]]; then
  section "Cài dependencies"
  npm install
fi

# Luôn cô lập dữ liệu local khỏi Cloud SQL và Cloud Storage production, kể cả
# khi .env có chứa cấu hình GCP. Có thể đổi URL PostgreSQL local bằng biến
# BQDMATH_LOCAL_DATABASE_URL nhưng không tái sử dụng các biến production.
export DATABASE_URL="${BQDMATH_LOCAL_DATABASE_URL:-postgresql://bqdmath:bqdmath_dev@127.0.0.1:5432/bqdmath}"
export DIRECT_URL="$DATABASE_URL"
export CLOUD_SQL_CONNECTION_NAME=""
export DB_HOST=""
export GCS_BUCKET_NAME=""

docker info >/dev/null 2>&1 \
  || fail "Docker chưa chạy. Hãy mở Docker Desktop rồi chạy lại."

section "Khởi động dịch vụ local"

if postgres_is_available; then
  printf 'PostgreSQL đã sẵn sàng tại 127.0.0.1:5432.\n'
else
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" \
    up -d --wait postgres
fi

if ocr_is_available; then
  printf 'OCR đã sẵn sàng tại 127.0.0.1:8001.\n'
else
  docker compose -f "$COMPOSE_FILE" --project-directory "$PROJECT_DIR" \
    up -d --wait ocr
fi

postgres_is_available || fail "PostgreSQL local chưa sẵn sàng."
ocr_is_available || fail "OCR local chưa sẵn sàng."

printf 'Database: PostgreSQL local (không dùng Cloud SQL production).\n'
printf 'PDF:      storage/uploads/ local (không dùng bucket production).\n'

if command_exists gcloud \
  && gcloud auth application-default print-access-token >/dev/null 2>&1; then
  printf 'Vertex AI: ADC đã sẵn sàng; Gemini có thể chạy từ local.\n'
else
  printf 'Vertex AI: chưa có ADC; Gemini sẽ lỗi và luồng quét sẽ fallback sang OCR local.\n'
  printf '           Cấu hình bằng: npm run setup:local:vertex\n'
fi

section "Áp dụng database migrations"
npx prisma migrate deploy

section "Chạy BQD Math tại http://localhost:3000"
exec npm run dev
