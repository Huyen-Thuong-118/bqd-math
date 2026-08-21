/**
 * Khối minh hoạ toán học của Hero — kim tự tháp "kính" + các chip ký hiệu
 * toán nổi quanh, dựng hoàn toàn bằng SVG/CSS (không dùng ảnh ngoài để
 * tránh vấn đề bản quyền và giữ style thống nhất với phần còn lại).
 *
 * Xếp 3 lớp để tạo chiều sâu:
 *   1. blob gradient mờ (blur-3xl) ở dưới cùng
 *   2. kim tự tháp SVG bán trong suốt, nổi lên xuống nhẹ
 *   3. chip ký hiệu kính mờ nổi phía trước, lệch nhịp nhau bằng delay
 *
 * Thuần trang trí → aria-hidden để screen reader bỏ qua.
 */

/** Chip ký hiệu toán: vị trí đặt theo % để co giãn cùng khung. */
const SYMBOL_CHIPS = [
  { symbol: "∑", className: "left-[2%] top-[18%]", delay: "0s" },
  { symbol: "π", className: "right-[4%] top-[8%]", delay: "1.2s" },
  { symbol: "x²", className: "left-[8%] bottom-[16%]", delay: "2.1s" },
  { symbol: "√", className: "right-[0%] bottom-[26%]", delay: "0.6s" },
  { symbol: "∫", className: "right-[18%] bottom-[4%]", delay: "1.7s" },
];

export function MathGlassVisual() {
  return (
    <div
      aria-hidden
      className="relative mx-auto aspect-square w-full max-w-[26rem] select-none"
    >
      {/* --- Lớp 1: blob nền tạo chiều sâu --- */}
      <div className="absolute -top-6 -left-8 -z-10 size-72 rounded-full bg-gradient-to-br from-navy-200/40 to-pastel-200/60 blur-3xl animate-drift" />
      {/* right-4 (không phải right-0): chừa chỗ cho animate-drift phóng to 1.06 */}
      <div
        className="absolute right-4 bottom-0 -z-10 size-64 rounded-full bg-gradient-to-tr from-pastel-400/40 to-navy-100/50 blur-3xl animate-drift"
        style={{ animationDelay: "3s" }}
      />

      {/* --- Lớp 2: kim tự tháp kính --- */}
      <svg
        viewBox="0 0 320 320"
        className="size-full drop-shadow-[0_18px_40px_rgba(27,42,74,0.22)] animate-float"
      >
        <defs>
          {/* Mặt trước trái — sáng nhất, hứng "ánh sáng" từ trên trái */}
          <linearGradient id="faceLeft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-pastel-100)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--color-navy-300)" stopOpacity="0.55" />
          </linearGradient>
          {/* Mặt trước phải — tối hơn để khối có cảm giác 3D */}
          <linearGradient id="faceRight" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-navy-400)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--color-pastel-300)" stopOpacity="0.5" />
          </linearGradient>
          {/* Đáy + mặt khuất: rất mờ, chỉ để "nhìn xuyên" qua kính */}
          <linearGradient id="faceBase" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-pastel-200)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--color-navy-200)" stopOpacity="0.35" />
          </linearGradient>
          <radialGradient id="groundGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-pastel-500)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-pastel-500)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Quầng sáng dưới chân khối, thay cho bóng đổ cứng */}
        <ellipse cx="160" cy="270" rx="120" ry="30" fill="url(#groundGlow)" />

        {/* Vòng quỹ đạo mảnh vòng quanh khối — thêm 1 lớp chiều sâu */}
        <ellipse
          cx="160"
          cy="212"
          rx="140"
          ry="46"
          fill="none"
          stroke="var(--color-navy-200)"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />

        {/* Cạnh khuất phía sau — nét đứt, nhìn xuyên qua kính */}
        <polygon
          points="160,44 160,148 44,208"
          fill="url(#faceBase)"
          opacity="0.35"
        />
        <polygon
          points="160,44 160,148 276,208"
          fill="url(#faceBase)"
          opacity="0.25"
        />
        <path
          d="M160 44 L160 148 M44 208 L160 148 L276 208"
          fill="none"
          stroke="var(--color-navy-300)"
          strokeOpacity="0.5"
          strokeWidth="1.5"
          strokeDasharray="5 6"
        />

        {/* Đáy hình thoi (đáy vuông nhìn theo phối cảnh) */}
        <polygon
          points="44,208 160,148 276,208 160,268"
          fill="url(#faceBase)"
          stroke="var(--color-navy-200)"
          strokeOpacity="0.6"
          strokeWidth="1.5"
        />

        {/* 2 mặt trước — phần "kính" chính */}
        <polygon
          points="160,44 44,208 160,268"
          fill="url(#faceLeft)"
          stroke="var(--color-navy-100)"
          strokeOpacity="0.9"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <polygon
          points="160,44 276,208 160,268"
          fill="url(#faceRight)"
          stroke="var(--color-navy-100)"
          strokeOpacity="0.9"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Vệt sáng chạy dọc cạnh trước — cho ra chất "thuỷ tinh" */}
        <path
          d="M160 44 L160 268"
          stroke="white"
          strokeOpacity="0.65"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M160 44 L44 208"
          stroke="white"
          strokeOpacity="0.4"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Đỉnh khối */}
        <circle cx="160" cy="44" r="5" fill="var(--color-pastel-50)" />
        <circle
          cx="160"
          cy="44"
          r="9"
          fill="none"
          stroke="var(--color-navy-200)"
          strokeOpacity="0.7"
          strokeWidth="1.5"
        />
      </svg>

      {/* --- Lớp 3: chip ký hiệu toán kính mờ --- */}
      {SYMBOL_CHIPS.map((chip) => (
        <span
          key={chip.symbol}
          style={{ animationDelay: chip.delay }}
          className={`absolute flex size-12 items-center justify-center rounded-2xl border border-white/60 bg-pastel-50/70 text-lg font-semibold text-navy-500 shadow-[0_8px_24px_rgba(27,42,74,0.14)] backdrop-blur-xl animate-float-slow sm:size-14 sm:text-xl ${chip.className}`}
        >
          {chip.symbol}
        </span>
      ))}
    </div>
  );
}
