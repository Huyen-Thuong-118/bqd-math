# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
# postinstall gọi Prisma và cần DIRECT_URL. Generate ở build stage sau khi đã
# có schema, nên không chạy lifecycle script tại đây.
RUN npm ci --ignore-scripts

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
# Prisma CLI chỉ kiểm tra dạng URL khi generate; build không kết nối DB thật.
ENV DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG DEPLOYMENT_VERSION=local
ENV DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION

RUN npx prisma generate
# Không đưa khóa Server Actions vào layer/image history. Cloud Build và lệnh
# build local truyền khóa bằng Docker BuildKit secret.
RUN --mount=type=secret,id=next_server_actions_key \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_server_actions_key)" \
    npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
