-- Đưa các thông báo lớp đang hiện có vào hộp thư của học sinh đang thuộc lớp.
-- Tách khỏi migration thêm enum vì PostgreSQL chỉ cho dùng enum value mới sau
-- khi transaction thêm enum đã commit.
INSERT INTO "Notification" (
  "id",
  "userId",
  "type",
  "title",
  "content",
  "href",
  "classAnnouncementId",
  "sentAt"
)
SELECT
  md5(enrollment."studentId" || ':' || announcement."id"),
  enrollment."studentId",
  'IN_APP'::"NotificationType",
  announcement."title",
  announcement."content",
  '/lop-hoc/' || announcement."classId",
  announcement."id",
  announcement."createdAt"
FROM "ClassAnnouncement" AS announcement
JOIN "ClassEnrollment" AS enrollment
  ON enrollment."classId" = announcement."classId"
WHERE announcement."isVisible" = true
ON CONFLICT ("userId", "classAnnouncementId") DO NOTHING;
