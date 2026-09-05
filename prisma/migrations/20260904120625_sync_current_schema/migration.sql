/*
  Warnings:

  - You are about to drop the column `teacherId` on the `Class` table. All the data in the column will be lost.
  - You are about to drop the `ClassStudent` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `level` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `schedule` to the `Class` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "Class_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "ClassStudent" DROP CONSTRAINT "ClassStudent_classId_fkey";

-- DropForeignKey
ALTER TABLE "ClassStudent" DROP CONSTRAINT "ClassStudent_userId_fkey";

-- AlterTable
ALTER TABLE "Class" DROP COLUMN "teacherId",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "level" "ClassLevel" NOT NULL,
ADD COLUMN     "schedule" TEXT NOT NULL,
ADD COLUMN     "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "maxAttempts" INTEGER;

-- DropTable
DROP TABLE "ClassStudent";

-- CreateTable
CREATE TABLE "ClassEnrollment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamClass" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "ExamClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassReviewQuestion" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "ClassReviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassEnrollment_classId_studentId_key" ON "ClassEnrollment"("classId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamClass_examId_classId_key" ON "ExamClass"("examId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassReviewQuestion_questionId_classId_key" ON "ClassReviewQuestion"("questionId", "classId");

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamClass" ADD CONSTRAINT "ExamClass_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamClass" ADD CONSTRAINT "ExamClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassReviewQuestion" ADD CONSTRAINT "ClassReviewQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ReviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassReviewQuestion" ADD CONSTRAINT "ClassReviewQuestion_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
