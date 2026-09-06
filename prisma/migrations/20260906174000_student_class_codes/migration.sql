-- Add stable, human-readable management codes. They are identifiers only,
-- never authentication secrets.
ALTER TABLE "User" ADD COLUMN "studentCode" TEXT;
ALTER TABLE "Class" ADD COLUMN "code" TEXT;

WITH ranked_students AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number
  FROM "User"
  WHERE "role" = 'STUDENT'
)
UPDATE "User" AS users
SET "studentCode" = 'HS-' || LPAD(ranked_students.row_number::TEXT, 8, '0')
FROM ranked_students
WHERE users."id" = ranked_students."id";

WITH ranked_classes AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS row_number
  FROM "Class"
)
UPDATE "Class" AS classes
SET "code" = 'LOP-' || LPAD(ranked_classes.row_number::TEXT, 6, '0')
FROM ranked_classes
WHERE classes."id" = ranked_classes."id";

ALTER TABLE "Class" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "User_studentCode_key" ON "User"("studentCode");
CREATE UNIQUE INDEX "Class_code_key" ON "Class"("code");
