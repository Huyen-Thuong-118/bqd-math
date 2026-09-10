-- Mã quản lý chuyển sang số thứ tự ngắn, ổn định. Tài khoản chờ duyệt chưa
-- có mã; mã học sinh được cấp đúng lúc giáo viên duyệt tài khoản.
CREATE SEQUENCE "student_code_seq" START 1;
CREATE SEQUENCE "class_code_seq" START 1;

UPDATE "User"
SET "studentCode" = NULL
WHERE "role" = 'STUDENT' AND "status" = 'PENDING';

UPDATE "User"
SET "studentCode" = '__old__' || "id"
WHERE "role" = 'STUDENT' AND "status" <> 'PENDING';

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS number
  FROM "User"
  WHERE "role" = 'STUDENT' AND "status" <> 'PENDING'
)
UPDATE "User" AS student
SET "studentCode" = numbered.number::text
FROM numbered
WHERE student."id" = numbered."id";

SELECT setval(
  'student_code_seq',
  COALESCE((SELECT MAX("studentCode"::bigint) FROM "User" WHERE "role" = 'STUDENT' AND "studentCode" ~ '^[0-9]+$'), 0) + 1,
  false
);

UPDATE "Class" SET "code" = '__old__' || "id";

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS number
  FROM "Class"
)
UPDATE "Class" AS classroom
SET "code" = numbered.number::text
FROM numbered
WHERE classroom."id" = numbered."id";

SELECT setval(
  'class_code_seq',
  COALESCE((SELECT MAX("code"::bigint) FROM "Class" WHERE "code" ~ '^[0-9]+$'), 0) + 1,
  false
);

-- Thông báo trong ứng dụng được liên kết với thông báo lớp để tự ẩn/xóa theo
-- thông báo gốc và lưu trạng thái đã đọc riêng cho từng học sinh.
ALTER TYPE "NotificationType" ADD VALUE 'IN_APP';

ALTER TABLE "Notification"
ADD COLUMN "title" TEXT,
ADD COLUMN "href" TEXT,
ADD COLUMN "readAt" TIMESTAMP(3),
ADD COLUMN "classAnnouncementId" TEXT;

CREATE UNIQUE INDEX "Notification_userId_classAnnouncementId_key"
ON "Notification"("userId", "classAnnouncementId");

CREATE INDEX "Notification_userId_type_readAt_sentAt_idx"
ON "Notification"("userId", "type", "readAt", "sentAt");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_classAnnouncementId_fkey"
FOREIGN KEY ("classAnnouncementId") REFERENCES "ClassAnnouncement"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
