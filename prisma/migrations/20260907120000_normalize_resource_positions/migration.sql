-- Backfill deterministic sibling order for records that existed before the
-- folder-tree feature. New move/reorder actions keep these positions dense.
WITH ranked_folders AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "kind", "parentId"
      ORDER BY "position", "createdAt", "id"
    ) - 1 AS next_position
  FROM "Folder"
)
UPDATE "Folder" AS folders
SET "position" = ranked_folders.next_position
FROM ranked_folders
WHERE folders."id" = ranked_folders."id";

WITH ranked_documents AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "folderId"
      ORDER BY "position", "createdAt", "id"
    ) - 1 AS next_position
  FROM "Document"
)
UPDATE "Document" AS documents
SET "position" = ranked_documents.next_position
FROM ranked_documents
WHERE documents."id" = ranked_documents."id";

WITH ranked_exams AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "folderId"
      ORDER BY "position", "createdAt", "id"
    ) - 1 AS next_position
  FROM "Exam"
)
UPDATE "Exam" AS exams
SET "position" = ranked_exams.next_position
FROM ranked_exams
WHERE exams."id" = ranked_exams."id";
