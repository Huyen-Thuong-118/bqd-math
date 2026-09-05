-- One class can have multiple weekly sessions.
CREATE TABLE "ClassScheduleSlot" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    CONSTRAINT "ClassScheduleSlot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClassScheduleSlot"
ADD CONSTRAINT "ClassScheduleSlot_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ClassScheduleSlot_classId_dayOfWeek_idx"
ON "ClassScheduleSlot"("classId", "dayOfWeek");

CREATE UNIQUE INDEX "ClassScheduleSlot_classId_dayOfWeek_startTime_endTime_key"
ON "ClassScheduleSlot"("classId", "dayOfWeek", "startTime", "endTime");

ALTER TABLE "ClassAnnouncement"
ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
