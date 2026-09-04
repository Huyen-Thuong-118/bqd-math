/**
 * Hoạ tiết toán học rải rác trên panel trái của layout auth — thuần trang trí
 * nên aria-hidden, tránh screen reader đọc các ký tự này.
 *
 * Chỉ 5 ký hiệu, opacity rất thấp: chủ đích tối giản, không cạnh tranh với
 * logo/slogan/nút bấm nằm cùng panel (xem AGENTS.md prompt gốc — "không rải
 * dày đặc").
 */
export function MathDoodles() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      <span className="absolute top-16 right-10 text-6xl text-pastel-200/10">
        π
      </span>
      <span className="absolute top-1/3 -left-2 rotate-[-12deg] text-5xl text-pastel-200/10">
        ∑
      </span>
      <span className="absolute right-6 bottom-40 rotate-[8deg] text-6xl text-pastel-200/10">
        ∫
      </span>
      <span className="absolute top-[58%] left-10 text-4xl text-pastel-200/10">
        x²
      </span>
      <span className="absolute bottom-16 left-1/3 text-5xl text-pastel-200/10">
        √
      </span>
    </div>
  );
}
