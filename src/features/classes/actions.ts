"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireActiveAdminId } from "@/features/exams/admin";
import { isValidClassCode, normalizeClassCode } from "@/lib/management-codes";
import { formatClassSchedule, type ClassScheduleSlotInput } from "./schedule";

export type ClassActionResult = { success: true } | { success: false; error: string };

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function refreshClasses(classId?: string) {
  revalidatePath("/admin/lop-hoc");
  revalidatePath("/admin/de-thi/tao-moi");
  revalidatePath("/admin/tai-lieu");
  revalidatePath("/admin/cau-hoi-on-tap");
  revalidatePath("/lop-hoc");
  if (classId) revalidatePath(`/lop-hoc/${classId}`);
}

function validateClassInput(formData: FormData) {
  const name = value(formData, "name");
  const code = normalizeClassCode(value(formData, "code"));
  const description = value(formData, "description");
  const level = value(formData, "level") === "ADVANCED" ? "ADVANCED" : "BASIC";
  if (name.length < 2 || name.length > 100) return { error: "Tên lớp phải có từ 2 đến 100 ký tự." } as const;
  if (!isValidClassCode(code)) return { error: "Mã lớp gồm 2–30 ký tự A–Z, 0–9, dấu gạch ngang hoặc gạch dưới." } as const;
  if (description.length > 1000) return { error: "Mô tả tối đa 1.000 ký tự." } as const;
  let slots: ClassScheduleSlotInput[];
  try {
    const parsed: unknown = JSON.parse(value(formData, "scheduleSlots"));
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 14) throw new Error();
    slots = parsed.map((slot) => {
      if (!slot || typeof slot !== "object") throw new Error();
      const item = slot as Record<string, unknown>;
      const dayOfWeek = Number(item.dayOfWeek);
      const startTime = String(item.startTime ?? "");
      const endTime = String(item.endTime ?? "");
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) throw new Error();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || startTime >= endTime) throw new Error();
      return { dayOfWeek, startTime, endTime };
    });
    const unique = new Set(slots.map((slot) => `${slot.dayOfWeek}:${slot.startTime}:${slot.endTime}`));
    if (unique.size !== slots.length) return { error: "Lịch học đang có buổi bị trùng." } as const;
  } catch {
    return { error: "Hãy thêm từ 1 đến 14 buổi học và kiểm tra lại giờ bắt đầu/kết thúc." } as const;
  }
  return {
    data: { name, code, level, schedule: formatClassSchedule(slots), description: description || null },
    slots,
  } as const;
}

export async function createClass(formData: FormData): Promise<ClassActionResult> {
  try {
    await requireActiveAdminId();
    const parsed = validateClassInput(formData);
    if ("error" in parsed) return { success: false, error: parsed.error ?? "Thông tin lớp không hợp lệ." };
    await db.class.create({
      data: {
        ...parsed.data,
        scheduleSlots: { create: parsed.slots },
      },
    });
    refreshClasses();
    return { success: true };
  } catch (error) {
    console.error("createClass thất bại:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { success: false, error: "Mã lớp đã được sử dụng." };
    return { success: false, error: "Không thể tạo lớp." };
  }
}

export async function updateClass(classId: string, formData: FormData): Promise<ClassActionResult> {
  try {
    await requireActiveAdminId();
    const parsed = validateClassInput(formData);
    if ("error" in parsed) return { success: false, error: parsed.error ?? "Thông tin lớp không hợp lệ." };
    const exists = await db.class.findUnique({ where: { id: classId }, select: { id: true } });
    if (!exists) return { success: false, error: "Không tìm thấy lớp." };
    await db.$transaction([
      db.classScheduleSlot.deleteMany({ where: { classId } }),
      db.class.update({
        where: { id: classId },
        data: {
          ...parsed.data,
          scheduleSlots: { create: parsed.slots },
        },
      }),
    ]);
    refreshClasses(classId);
    return { success: true };
  } catch (error) {
    console.error("updateClass thất bại:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { success: false, error: "Mã lớp đã được sử dụng." };
    return { success: false, error: "Không thể cập nhật lớp." };
  }
}

export async function toggleClassArchive(classId: string): Promise<ClassActionResult> {
  try {
    await requireActiveAdminId();
    const current = await db.class.findUnique({ where: { id: classId }, select: { status: true } });
    if (!current) return { success: false, error: "Không tìm thấy lớp." };
    await db.class.update({
      where: { id: classId },
      data: { status: current.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" },
    });
    refreshClasses(classId);
    return { success: true };
  } catch (error) {
    console.error("toggleClassArchive thất bại:", error);
    return { success: false, error: "Không thể đổi trạng thái lớp." };
  }
}

export async function setClassEnrollments(classId: string, studentIds: string[]): Promise<ClassActionResult> {
  try {
    await requireActiveAdminId();
    const normalizedIds = [...new Set(studentIds.filter((id) => typeof id === "string" && id.length <= 100))];
    const [classroom, validStudentCount] = await Promise.all([
      db.class.findFirst({ where: { id: classId, status: "ACTIVE" }, select: { id: true } }),
      db.user.count({ where: { id: { in: normalizedIds }, role: "STUDENT", status: "ACTIVE" } }),
    ]);
    if (!classroom) return { success: false, error: "Không tìm thấy lớp đang hoạt động." };
    if (validStudentCount !== normalizedIds.length) return { success: false, error: "Danh sách có học sinh không hợp lệ hoặc chưa hoạt động." };
    await db.$transaction([
      db.classEnrollment.deleteMany({ where: { classId, studentId: { notIn: normalizedIds } } }),
      db.classEnrollment.createMany({
        data: normalizedIds.map((studentId) => ({ classId, studentId })),
        skipDuplicates: true,
      }),
    ]);
    refreshClasses(classId);
    return { success: true };
  } catch (error) {
    console.error("setClassEnrollments thất bại:", error);
    return { success: false, error: "Không thể cập nhật danh sách học sinh." };
  }
}

export async function createClassAnnouncement(classId: string, formData: FormData): Promise<ClassActionResult> {
  try {
    await requireActiveAdminId();
    const title = value(formData, "title");
    const content = value(formData, "content");
    if (title.length < 2 || title.length > 120 || content.length < 2 || content.length > 2000) {
      return { success: false, error: "Tiêu đề hoặc nội dung thông báo không hợp lệ." };
    }
    const classroom = await db.class.findFirst({ where: { id: classId, status: "ACTIVE" }, select: { id: true } });
    if (!classroom) return { success: false, error: "Lớp đã lưu trữ không nhận thông báo mới." };
    await db.classAnnouncement.create({ data: { classId, title, content } });
    refreshClasses(classId);
    return { success: true };
  } catch (error) {
    console.error("createClassAnnouncement thất bại:", error);
    return { success: false, error: "Không thể đăng thông báo." };
  }
}

export async function toggleClassAnnouncement(
  classId: string,
  announcementId: string,
): Promise<ClassActionResult> {
  try {
    await requireActiveAdminId();
    const announcement = await db.classAnnouncement.findFirst({
      where: { id: announcementId, classId },
      select: { isVisible: true },
    });
    if (!announcement) return { success: false, error: "Không tìm thấy thông báo." };
    await db.classAnnouncement.update({
      where: { id: announcementId },
      data: { isVisible: !announcement.isVisible },
    });
    refreshClasses(classId);
    return { success: true };
  } catch (error) {
    console.error("toggleClassAnnouncement thất bại:", error);
    return { success: false, error: "Không thể đổi trạng thái thông báo." };
  }
}

export async function deleteClassAnnouncement(
  classId: string,
  announcementId: string,
): Promise<ClassActionResult> {
  try {
    await requireActiveAdminId();
    const result = await db.classAnnouncement.deleteMany({
      where: { id: announcementId, classId },
    });
    if (!result.count) return { success: false, error: "Không tìm thấy thông báo." };
    refreshClasses(classId);
    return { success: true };
  } catch (error) {
    console.error("deleteClassAnnouncement thất bại:", error);
    return { success: false, error: "Không thể xóa thông báo." };
  }
}
