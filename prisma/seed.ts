// Tạo/cập nhật đúng 1 tài khoản ADMIN (giáo viên chính) — ADMIN không đăng ký
// qua form, chỉ có được bằng cách chạy script này. Xem README "Bước tiếp theo".
//
// Chạy: npm run seed
// (hoặc npx prisma db seed / tự động sau `prisma migrate dev`, xem
// migrations.seed trong prisma.config.ts)
import "dotenv/config";

import { db } from "../src/lib/db";
import { nextClassCode, nextStudentCode } from "../src/lib/management-codes";
import { hashPassword } from "../src/lib/password";

const DEMO_CLASS_ID = "slice1-demo-class";
const DEMO_EXAM_ID = "slice1-demo-exam";

const DEMO_QUESTIONS = [
  {
    content: "Giá trị của 2 + 3 bằng bao nhiêu?",
    options: ["A. 4", "B. 5", "C. 6", "D. 7"],
    correctAnswer: "B",
    explanation: "Cộng 2 với 3 được 5.",
  },
  {
    content: "Nghiệm của phương trình x + 4 = 9 là:",
    options: ["A. x = 3", "B. x = 4", "C. x = 5", "D. x = 13"],
    correctAnswer: "C",
    explanation: "Chuyển 4 sang vế phải: x = 9 - 4 = 5.",
  },
  {
    content: "Số nào sau đây là số nguyên tố?",
    options: ["A. 9", "B. 15", "C. 17", "D. 21"],
    correctAnswer: "C",
    explanation: "17 chỉ có hai ước dương là 1 và 17.",
  },
  {
    content: "Căn bậc hai số học của 64 là:",
    options: ["A. -8", "B. 8", "C. 16", "D. 32"],
    correctAnswer: "B",
    explanation: "8² = 64 và căn bậc hai số học luôn không âm.",
  },
  {
    content: "Tam giác có ba cạnh bằng nhau được gọi là:",
    options: ["A. Tam giác vuông", "B. Tam giác cân", "C. Tam giác đều", "D. Tam giác tù"],
    correctAnswer: "C",
    explanation: "Tam giác đều có ba cạnh bằng nhau.",
  },
  {
    content: "Kết quả của 3² × 3³ là:",
    options: ["A. 3⁵", "B. 3⁶", "C. 9⁵", "D. 6⁵"],
    correctAnswer: "A",
    explanation: "Hai lũy thừa cùng cơ số nhân nhau thì cộng số mũ: 3² × 3³ = 3⁵.",
  },
  {
    content: "Đồ thị hàm số y = 2x + 1 đi qua điểm nào?",
    options: ["A. (0; 0)", "B. (0; 1)", "C. (1; 1)", "D. (2; 2)"],
    correctAnswer: "B",
    explanation: "Thay x = 0 ta có y = 1, nên đồ thị đi qua (0; 1).",
  },
  {
    content: "Trung bình cộng của 4, 6 và 8 là:",
    options: ["A. 5", "B. 6", "C. 7", "D. 18"],
    correctAnswer: "B",
    explanation: "(4 + 6 + 8) / 3 = 18 / 3 = 6.",
  },
  {
    content: "Diện tích hình chữ nhật dài 7 cm, rộng 4 cm là:",
    options: ["A. 11 cm²", "B. 22 cm²", "C. 28 cm²", "D. 35 cm²"],
    correctAnswer: "C",
    explanation: "Diện tích bằng chiều dài nhân chiều rộng: 7 × 4 = 28 cm².",
  },
  {
    content: "Phân số 6/8 rút gọn bằng:",
    options: ["A. 2/3", "B. 3/4", "C. 4/5", "D. 5/6"],
    correctAnswer: "B",
    explanation: "Chia cả tử và mẫu cho 2: 6/8 = 3/4.",
  },
];

async function seedSliceOneDemo() {
  if (process.env.SEED_DEMO_DATA !== "true") return;

  const email = process.env.SEED_STUDENT_EMAIL ?? "student@bqdmath.local";
  const password = process.env.SEED_STUDENT_PASSWORD ?? "BqdMathStudent123!";
  const passwordHash = await hashPassword(password);
  const existingStudent = await db.user.findUnique({ where: { email }, select: { studentCode: true } });
  const studentCode = existingStudent?.studentCode && /^\d+$/.test(existingStudent.studentCode)
    ? existingStudent.studentCode
    : await db.$transaction((transaction) => nextStudentCode(transaction));
  const student = await db.user.upsert({
    where: { email },
    update: {
      role: "STUDENT",
      status: "ACTIVE",
      passwordHash,
      mustChangePassword: false,
      studentCode,
      studentPhone: "0911111111",
      parentPhone: "0922222222",
    },
    create: {
      name: "Học sinh Demo",
      email,
      role: "STUDENT",
      status: "ACTIVE",
      studentCode,
      passwordHash,
      studentPhone: "0911111111",
      parentPhone: "0922222222",
    },
  });

  const existingClass = await db.class.findUnique({ where: { id: DEMO_CLASS_ID }, select: { code: true } });
  const classCode = existingClass?.code && /^\d+$/.test(existingClass.code)
    ? existingClass.code
    : await db.$transaction((transaction) => nextClassCode(transaction));
  await db.class.upsert({
    where: { id: DEMO_CLASS_ID },
    update: {},
    create: {
      id: DEMO_CLASS_ID,
      name: "Lớp Demo Lát cắt 1",
      code: classCode,
      level: "BASIC",
      schedule: "Thứ 7, 08:00–10:00",
      description: "Lớp dữ liệu mẫu để kiểm thử luồng giao đề và chấm điểm.",
    },
  });
  await db.classScheduleSlot.createMany({
    data: [{ classId: DEMO_CLASS_ID, dayOfWeek: 6, startTime: "08:00", endTime: "10:00" }],
    skipDuplicates: true,
  });
  await db.classEnrollment.upsert({
    where: {
      classId_studentId: { classId: DEMO_CLASS_ID, studentId: student.id },
    },
    update: {},
    create: { classId: DEMO_CLASS_ID, studentId: student.id },
  });

  await db.exam.upsert({
    where: { id: DEMO_EXAM_ID },
    update: {
      title: "Đề kiểm tra Toán demo — 10 câu",
      mode: "MOCK",
      durationMinutes: 20,
      maxAttempts: 3,
      isForever: true,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    create: {
      id: DEMO_EXAM_ID,
      title: "Đề kiểm tra Toán demo — 10 câu",
      mode: "MOCK",
      source: "QUESTION_BANK",
      examFileUrl: null,
      durationMinutes: 20,
      maxAttempts: 3,
      isForever: true,
      showAnswer: true,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  await db.examClass.upsert({
    where: { examId_classId: { examId: DEMO_EXAM_ID, classId: DEMO_CLASS_ID } },
    update: {},
    create: { examId: DEMO_EXAM_ID, classId: DEMO_CLASS_ID },
  });

  const questionIds = DEMO_QUESTIONS.map((_, index) => `${DEMO_EXAM_ID}-q${index + 1}`);
  await db.examQuestion.deleteMany({
    where: { examId: DEMO_EXAM_ID, id: { notIn: questionIds } },
  });
  for (const [index, question] of DEMO_QUESTIONS.entries()) {
    await db.examQuestion.upsert({
      where: { id: questionIds[index] },
      update: { number: index + 1, points: 1, ...question },
      create: {
        id: questionIds[index],
        examId: DEMO_EXAM_ID,
        number: index + 1,
        points: 1,
        ...question,
      },
    });
  }

  console.log(`Seed demo Slice 1 OK: ${student.email} / ${DEMO_QUESTIONS.length} câu`);
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const phone = process.env.SEED_ADMIN_PHONE;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !phone || !password) {
    throw new Error(
      "Thiếu SEED_ADMIN_EMAIL / SEED_ADMIN_PHONE / SEED_ADMIN_PASSWORD trong .env — xem .env.example.",
    );
  }

  const passwordHash = await hashPassword(password);

  // parentPhone là field bắt buộc trên User (dùng cho HS), nhưng ADMIN không
  // có phụ huynh — tạm dùng lại SĐT admin cho field này. Xem ghi chú cuối
  // buổi làm schema: cân nhắc tách field riêng cho STUDENT nếu thấy gượng.
  const adminOnlyFields = {
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    mustChangePassword: false,
    passwordHash,
    studentPhone: phone,
    parentPhone: phone,
  };

  const admin = await db.user.upsert({
    where: { email },
    update: adminOnlyFields,
    create: {
      name: "Admin BQD Math", // TODO: đổi tên thật, chỉ ảnh hưởng hiển thị
      email,
      ...adminOnlyFields,
    },
  });

  console.log(`Seed ADMIN OK: ${admin.email} (id: ${admin.id})`);
  await seedSliceOneDemo();
}

main()
  .catch((error) => {
    console.error("Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
