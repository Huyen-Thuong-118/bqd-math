/**
 * Ngày thi tốt nghiệp THPT Quốc gia (THPTQG) — dùng cho khối đếm ngược ở
 * Trang chủ.
 *
 * Bộ GD&ĐT công bố lịch thi CHÍNH THỨC mỗi năm và ngày thi có thể xê dịch
 * giữa các năm (ví dụ kỳ 2026 tổ chức sớm hơn 2 tuần so với các năm trước:
 * 11–12/6/2026 thay vì cuối tháng 6 như thường lệ). Vì vậy KHÔNG có công
 * thức nào tính đúng tuyệt đối ngày thi của năm kế tiếp.
 *
 * => Khi có lịch thi CHÍNH THỨC của năm sắp tới, chỉ cần sửa 4 hằng số dưới
 * đây theo đúng ngày + giờ bắt đầu buổi thi đầu tiên (thường là môn Ngữ văn,
 * buổi sáng). `getNextExamTimestamp()` tự chọn năm: hễ mốc ngày/tháng của
 * năm hiện tại đã trôi qua, tự cộng thêm 1 năm — nên sau khi sửa 1 lần,
 * countdown vẫn tự "nhảy" đúng sang năm sau mà KHÔNG cần đụng lại code hay
 * hardcode năm.
 */
export const EXAM_MONTH = 6;
export const EXAM_DAY = 26;
export const EXAM_HOUR = 7;
export const EXAM_MINUTE = 30;

const VN_UTC_OFFSET_HOURS = 7;

function examUtcMsForYear(year: number): number {
  return Date.UTC(year, EXAM_MONTH - 1, EXAM_DAY, EXAM_HOUR - VN_UTC_OFFSET_HOURS, EXAM_MINUTE, 0);
}

export function getNextExamTimestamp(now: number = Date.now()): number {
  const year = new Date(now).getUTCFullYear();
  const thisYearMs = examUtcMsForYear(year);
  return thisYearMs > now ? thisYearMs : examUtcMsForYear(year + 1);
}
