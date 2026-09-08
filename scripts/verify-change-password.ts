import "dotenv/config";

import { randomUUID } from "node:crypto";

import { changePasswordForUser } from "../src/features/auth/change-password-service";
import { db } from "../src/lib/db";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { requireTestDatabase } from "./test-database-guard";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  requireTestDatabase();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const oldPassword = "OldPassword123!";
  const newPassword = "NewPassword456!";
  const user = await db.user.create({
    data: {
      name: "Verify Password",
      email: `password-${suffix}@verify.test`,
      studentPhone: `03${Date.now().toString().slice(-8)}`,
      parentPhone: `07${Date.now().toString().slice(-8)}`,
      studentCode: `HS-${suffix.slice(0, 8).toUpperCase()}`,
      passwordHash: await hashPassword(oldPassword),
      mustChangePassword: true,
      role: "STUDENT",
      status: "ACTIVE",
    },
  });

  try {
    const wrong = await changePasswordForUser(user.id, {
      currentPassword: "WrongPassword123!",
      password: newPassword,
      confirmPassword: newPassword,
    });
    assert(!wrong.success && wrong.field === "currentPassword", "Sai mật khẩu cũ phải bị từ chối.");
    const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    assert(Boolean(unchanged.passwordHash) && await verifyPassword(oldPassword, unchanged.passwordHash!), "Sai mật khẩu cũ không được đổi DB.");

    const changed = await changePasswordForUser(user.id, {
      currentPassword: oldPassword,
      password: newPassword,
      confirmPassword: newPassword,
    });
    assert(changed.success, "Mật khẩu hợp lệ phải đổi được.");
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true, mustChangePassword: true } });
    assert(updated.passwordHash && !(await verifyPassword(oldPassword, updated.passwordHash)), "Mật khẩu cũ vẫn còn đăng nhập được.");
    assert(updated.passwordHash && await verifyPassword(newPassword, updated.passwordHash), "Mật khẩu mới chưa được lưu đúng.");
    assert(!updated.mustChangePassword, "Đổi thành công phải xóa cờ mật khẩu tạm.");

    await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    const suspended = await changePasswordForUser(user.id, {
      currentPassword: newPassword,
      password: "AnotherPassword789!",
      confirmPassword: "AnotherPassword789!",
    });
    assert(!suspended.success, "Tài khoản SUSPENDED không được đổi mật khẩu.");
    console.log("✓ Đổi mật khẩu: sai mật khẩu cũ, happy path và tài khoản SUSPENDED đều đạt.");
  } finally {
    await db.user.deleteMany({ where: { id: user.id } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
