-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "level" SET DEFAULT 'BASIC',
ALTER COLUMN "schedule" SET DEFAULT '';

-- AlterTable
ALTER TABLE "ClassAnnouncement" ALTER COLUMN "updatedAt" DROP DEFAULT;
