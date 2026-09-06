// Validate tay, chưa dùng zod: project hiện chưa cài zod và cả module auth này
// còn là UI thuần (xem README.md) — thêm zod cho vài hàm nhỏ này là thừa.

export const VN_PHONE_REGEX = /^0\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trả về thông báo lỗi, hoặc undefined nếu hợp lệ — cho phép gọi trực tiếp
 * vào state lỗi của form: `setErrors({ email: validateEmail(email) })`. */
type FieldError = string | undefined;

export function validateLoginIdentifier(value: string): FieldError {
  return value.trim() ? undefined : "Vui lòng nhập số điện thoại hoặc email";
}

export function validateLoginPassword(value: string): FieldError {
  return value ? undefined : "Vui lòng nhập mật khẩu";
}

export function validateFullName(value: string): FieldError {
  const trimmed = value.trim();
  if (!trimmed) return "Vui lòng nhập họ và tên";
  if (trimmed.split(/\s+/).length < 2) return "Vui lòng nhập đầy đủ họ và tên";
  return undefined;
}

export function validatePhone(value: string): FieldError {
  const trimmed = value.trim();
  if (!trimmed) return "Vui lòng nhập số điện thoại";
  if (!VN_PHONE_REGEX.test(trimmed)) {
    return "Số điện thoại không hợp lệ (VD: 0912345678)";
  }
  return undefined;
}

export function validateParentPhone(
  parentPhone: string,
  studentPhone: string,
): FieldError {
  const base = validatePhone(parentPhone);
  if (base) return base;
  if (parentPhone.trim() === studentPhone.trim()) {
    return "Số điện thoại phụ huynh phải khác số điện thoại học sinh";
  }
  return undefined;
}

export function validateEmail(value: string): FieldError {
  const trimmed = value.trim();
  if (!trimmed) return "Vui lòng nhập email";
  if (!EMAIL_REGEX.test(trimmed)) return "Email không đúng định dạng";
  return undefined;
}

export function validateRegisterPassword(value: string): FieldError {
  if (!value) return "Vui lòng nhập mật khẩu";
  if (value.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
  if (value.length > 128) return "Mật khẩu không được vượt quá 128 ký tự";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return "Mật khẩu phải có ít nhất 1 chữ và 1 số";
  }
  return undefined;
}

export function validateConfirmPassword(
  value: string,
  password: string,
): FieldError {
  if (!value) return "Vui lòng xác nhận mật khẩu";
  if (value !== password) return "Mật khẩu xác nhận không khớp";
  return undefined;
}
