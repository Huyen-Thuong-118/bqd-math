import "dotenv/config";

import { db } from "../src/lib/db";
import { nextClassCode, nextStudentCode } from "../src/lib/management-codes";
import { hashPassword } from "../src/lib/password";
import { formatClassSchedule } from "../src/features/classes/schedule";

const STUDENT_COUNT = 30;
const CLASS_COUNT = 6;
const TEST_PASSWORD = process.env.SEED_TEST_STUDENT_PASSWORD ?? "HocSinh@123";

const familyNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ"];
const givenNames = ["Minh Anh", "Gia Huy", "Khánh Linh", "Đức Anh", "Thu Hà", "Quang Minh", "Bảo Ngọc", "Tuấn Kiệt", "Phương Anh", "Nhật Nam"];

const classSeeds = [
  { name: "Toán 10A — Thứ 2, Thứ 5", slots: [{ dayOfWeek: 1, startTime: "18:00", endTime: "19:30" }, { dayOfWeek: 4, startTime: "18:00", endTime: "19:30" }] },
  { name: "Toán 10B — Thứ 3, Thứ 6", slots: [{ dayOfWeek: 2, startTime: "18:00", endTime: "19:30" }, { dayOfWeek: 5, startTime: "18:00", endTime: "19:30" }] },
  { name: "Toán 11A — Ba buổi", slots: [{ dayOfWeek: 1, startTime: "19:30", endTime: "21:00" }, { dayOfWeek: 3, startTime: "19:30", endTime: "21:00" }, { dayOfWeek: 5, startTime: "19:30", endTime: "21:00" }] },
  { name: "Toán 11B — Cuối tuần", slots: [{ dayOfWeek: 6, startTime: "08:00", endTime: "10:00" }, { dayOfWeek: 0, startTime: "08:00", endTime: "10:00" }] },
  { name: "Ôn thi Toán 12 — Ca chiều", slots: [{ dayOfWeek: 2, startTime: "16:30", endTime: "18:00" }, { dayOfWeek: 4, startTime: "16:30", endTime: "18:00" }, { dayOfWeek: 6, startTime: "14:00", endTime: "16:00" }] },
  { name: "Luyện đề Toán 12 — Ca tối", slots: [{ dayOfWeek: 3, startTime: "18:30", endTime: "20:30" }, { dayOfWeek: 0, startTime: "18:30", endTime: "20:30" }] },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Không được tạo dữ liệu kiểm thử trong môi trường production.");
  }
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const students = [];
  for (let index = 1; index <= STUDENT_COUNT; index += 1) {
    const padded = String(index).padStart(2, "0");
    const email = `hocsinh${padded}@bqdmath.local`;
    const existing = await db.user.findUnique({ where: { email }, select: { studentCode: true } });
    const studentCode = existing?.studentCode && /^\d+$/.test(existing.studentCode)
      ? existing.studentCode
      : await db.$transaction((transaction) => nextStudentCode(transaction));
    const student = await db.user.upsert({
      where: { email },
      update: {
        name: `${familyNames[(index - 1) % familyNames.length]} ${givenNames[(index - 1) % givenNames.length]} ${padded}`,
        role: "STUDENT",
        status: "ACTIVE",
        passwordHash,
        mustChangePassword: false,
        studentCode,
        studentPhone: `09350000${padded}`,
        parentPhone: `09450000${padded}`,
      },
      create: {
        id: `test-student-${padded}`,
        name: `${familyNames[(index - 1) % familyNames.length]} ${givenNames[(index - 1) % givenNames.length]} ${padded}`,
        email,
        role: "STUDENT",
        status: "ACTIVE",
        studentCode,
        passwordHash,
        studentPhone: `09350000${padded}`,
        parentPhone: `09450000${padded}`,
      },
    });
    students.push(student);
  }

  for (let classIndex = 0; classIndex < CLASS_COUNT; classIndex += 1) {
    const seed = classSeeds[classIndex];
    const classId = `test-class-${String(classIndex + 1).padStart(2, "0")}`;
    const level = classIndex % 2 === 0 ? "BASIC" as const : "ADVANCED" as const;
    const existing = await db.class.findUnique({ where: { id: classId }, select: { code: true } });
    const classCode = existing?.code && /^\d+$/.test(existing.code)
      ? existing.code
      : await db.$transaction((transaction) => nextClassCode(transaction));
    await db.class.upsert({
      where: { id: classId },
      update: { name: seed.name, level, schedule: formatClassSchedule(seed.slots), status: "ACTIVE" },
      create: {
        id: classId,
        name: seed.name,
        code: classCode,
        level,
        schedule: formatClassSchedule(seed.slots),
        description: `Lớp kiểm thử số ${classIndex + 1}, có ${seed.slots.length} buổi học mỗi tuần.`,
        status: "ACTIVE",
      },
    });
    await db.$transaction([
      db.classScheduleSlot.deleteMany({ where: { classId } }),
      db.classScheduleSlot.createMany({ data: seed.slots.map((slot) => ({ classId, ...slot })) }),
      db.classEnrollment.deleteMany({ where: { classId } }),
      db.classEnrollment.createMany({
        data: students
          .filter((_, studentIndex) => (studentIndex + classIndex) % 3 !== 0)
          .map((student) => ({ classId, studentId: student.id })),
      }),
    ]);
    await db.classAnnouncement.upsert({
      where: { id: `${classId}-announcement` },
      update: { title: "Chào mừng vào lớp", content: `Đây là thông báo kiểm thử của ${seed.name}.`, isVisible: true },
      create: { id: `${classId}-announcement`, classId, title: "Chào mừng vào lớp", content: `Đây là thông báo kiểm thử của ${seed.name}.` },
    });
  }

  console.log(`✓ Đã tạo ${STUDENT_COUNT} học sinh và ${CLASS_COUNT} lớp kiểm thử.`);
  console.log("  Tài khoản: hocsinh01@bqdmath.local … hocsinh30@bqdmath.local");
  console.log(`  Mật khẩu chung: ${TEST_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Tạo dữ liệu kiểm thử thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
