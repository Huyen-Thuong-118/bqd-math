"use client";

import { useEffect, useState } from "react";

/**
 * Hình minh hoạ Hero — hình chóp S.ABCD có khối hộp chữ nhật MNPQ.TXYZ nội
 * tiếp (hình của bài toán cực trị thể tích khối hộp nội tiếp).
 *
 * Đây là hình học KHÔNG GIAN thật, không phải ảnh phẳng đem quay: mỗi điểm là
 * một toạ độ 3D, mỗi khung hình đều xoay quanh trục đứng rồi mới chiếu xuống
 * mặt phẳng SVG. Nhờ vậy quay đủ 360° vẫn luôn thấy khối, không có lúc nào
 * dẹt thành một nét kẻ như khi dùng `rotateY` của CSS lên một SVG phẳng.
 *
 * Mô hình dựng lại từ bản vẽ TikZ gốc: đáy là hình vuông cạnh 6, S nằm trên
 * tâm O, SO = 5.75 — chiếu ở góc xuất phát cho đúng tỉ lệ hình gốc.
 *
 * Hai chuyển động chạy song song trong cùng 1 vòng rAF:
 *   1. cả khối xoay quanh trục đứng, 1 vòng 20s
 *   2. khối hộp bên trong "phồng - xẹp" theo tham số s, 1 chu kỳ 6s
 *
 * Nét thấy / nét khuất KHÔNG cố định mà tính lại theo góc nhìn: mặt bên nào
 * quay lưng lại người xem thì các cạnh chỉ thuộc mặt đó chuyển sang nét đứt.
 *
 * Thuần trang trí → aria-hidden, tránh đọc 18 nhãn điểm cho screen reader.
 */

type Vec3 = readonly [number, number, number];
type Pt = readonly [number, number];

/* ------------------------------------------------------------------ */
/* Mô hình 3D                                                          */
/* ------------------------------------------------------------------ */

const HALF = 3; // nửa cạnh đáy — đáy là hình vuông cạnh 6
const APEX_H = 5.75; // SO, lấy đúng từ hình TikZ gốc

/** Trục toạ độ: x sang phải, y hướng lên, z hướng về phía người xem. */
const SOLID = {
  S: [0, APEX_H, 0],
  A: [-HALF, 0, HALF],
  B: [HALF, 0, HALF],
  C: [HALF, 0, -HALF],
  D: [-HALF, 0, -HALF],
  O: [0, 0, 0],
  E: [0, 0, HALF], // trung điểm AB
  F: [HALF, 0, 0], // trung điểm BC
  G: [0, 0, -HALF], // trung điểm CD
  H: [-HALF, 0, 0], // trung điểm DA
} as const satisfies Record<string, Vec3>;

type VertexKey = keyof typeof SOLID;

const BASE_KEYS = ["A", "B", "C", "D"] as const;
/** Trung điểm cạnh đáy, xếp CÙNG THỨ TỰ với BASE_KEYS: E∈AB, F∈BC, G∈CD, H∈DA. */
const MID_KEYS = ["E", "F", "G", "H"] as const;

/** Cạnh luôn nằm trong lòng khối (hoặc trên mặt đáy) → góc nào cũng khuất. */
const ALWAYS_HIDDEN = [
  ["S", "O"],
  ["A", "C"],
  ["B", "D"],
  ["H", "F"],
  ["G", "E"],
] as const satisfies readonly (readonly [VertexKey, VertexKey])[];

type BoxKey = "M" | "N" | "P" | "Q" | "X" | "Y" | "Z" | "T";

/**
 * 8 đỉnh khối hộp tại tham số s = SM/SE (0 < s < 1).
 * Mặt trên MNPQ nằm trên 4 đoạn SE/SF/SG/SH nên cách đáy (1-s)·SO và cách trục
 * s·(nửa cạnh); mặt đáy XYZT là hình chiếu của nó xuống mặt đáy hình chóp.
 * Viết theo 2 tham số r, h chứ không nội suy từng đỉnh — cùng một công thức
 * nhưng khỏi lặp 8 lần.
 */
function buildBox(s: number): Record<BoxKey, Vec3> {
  const h = APEX_H * (1 - s);
  const r = HALF * s;
  return {
    M: [0, h, r],
    N: [r, h, 0],
    P: [0, h, -r],
    Q: [-r, h, 0],
    X: [0, 0, r],
    Y: [r, 0, 0],
    Z: [0, 0, -r],
    T: [-r, 0, 0],
  };
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

const TILT = (24 * Math.PI) / 180; // độ cao của mắt so với mặt đáy
const CAM_DIST = 32; // xa vừa đủ: phối cảnh nhẹ, không méo
const SCALE = 30; // đơn vị thế giới → px
const CX = 160;
const CY = 200;

/**
 * Xoay quanh trục đứng góc `theta` rồi chiếu phối cảnh xuống SVG.
 * Khung nhìn 0 0 320 290 đủ chứa mọi góc quay và mọi giá trị s (đã dò biên).
 */
function project([x, y, z]: Vec3, theta: number): Pt {
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  const xr = x * c + z * sn;
  const zr = -x * sn + z * c;

  const ct = Math.cos(TILT);
  const st = Math.sin(TILT);
  const yv = y * ct - zr * st; // chiều cao trên màn
  const zv = y * st + zr * ct; // độ sâu, dương = gần người xem

  const k = CAM_DIST / (CAM_DIST - zv);
  return [CX + xr * k * SCALE, CY - yv * k * SCALE];
}

/**
 * Diện tích có dấu của đa giác đã chiếu. Các mặt bên đều được liệt kê theo
 * chiều ngược kim đồng hồ NHÌN TỪ NGOÀI, nên dấu âm ⇔ mặt đang quay về phía
 * người xem (trục y của SVG hướng xuống nên dấu ngược với quy ước toán).
 */
function signedArea(poly: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

const toPoints = (poly: Pt[]) => poly.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * Vị trí đặt nhãn: đẩy khỏi trục đứng của khối một đoạn `pad` px, hướng đẩy
 * lấy từ chính phép chiếu nên nhãn luôn dạt đúng phía ngoài dù đang quay tới
 * góc nào. `dy` là phần chỉnh tay thêm theo chiều dọc (điểm nằm trên trục thì
 * chỉ còn mỗi phần này vì hướng ra ngoài không xác định).
 *
 * `tangential`: đẩy theo phương vuông góc với hướng ra ngoài. Dùng cho 4 đỉnh
 * đáy khối hộp — chúng nằm ngay trên các đoạn OE/OF/OG/OH nên nếu cũng đẩy ra
 * ngoài thì nhãn sẽ xếp thẳng hàng và đè lên nhãn E/F/G/H.
 */
function labelPos(
  v: Vec3,
  theta: number,
  pad: number,
  dy = 0,
  tangential = false,
): Pt {
  const [x, y, z] = v;
  const here = project(v, theta);
  const radius = Math.hypot(x, z);
  if (radius < 1e-6) return [here[0], here[1] + dy];

  const grow = 1 + 0.4 / radius; // dịch ra ngoài 0.4 đơn vị thế giới
  const [ox, oy] = project([x * grow, y, z * grow], theta);
  const len = Math.hypot(ox - here[0], oy - here[1]) || 1;
  const ux = (ox - here[0]) / len;
  const uy = (oy - here[1]) / len;
  const [dx, dz] = tangential ? [uy, -ux] : [ux, uy];
  return [here[0] + dx * pad, here[1] + dz * pad + dy];
}

/* ------------------------------------------------------------------ */
/* Chuyển động                                                         */
/* ------------------------------------------------------------------ */

const SPIN_PERIOD = 20; // giây cho 1 vòng 360°
const START_ANGLE = -0.45; // lệch sẵn ~26° để khung hình đứng yên vẫn ra dáng 3D
const PULSE_PERIOD = 6; // giây cho 1 chu kỳ phồng-xẹp
/**
 * s dao động theo hình sin — tự chậm lại ở 2 đầu nên khỏi cần easing.
 * Biên dưới dừng ở 0.28 chứ không xuống 0.15: dưới mức đó khối hộp mảnh như
 * cái kim, 8 đỉnh chiếu chồng lên nhau nên 8 nhãn M/N/P/Q/X/Y/Z/T đè lên
 * nhau đọc không ra. Biên độ này vẫn thấy rõ hộp phình to rồi xẹp lại.
 */
const S_MID = 0.56;
const S_AMP = 0.28;

export function PyramidBoxVisual() {
  // t = 0 cho lần render đầu (kể cả trên server) rồi mới chạy vòng lặp, nhờ
  // vậy markup SSR và client khớp nhau, không nhấp nháy lúc hydrate.
  const [t, setT] = useState(0);

  useEffect(() => {
    // prefers-reduced-motion: globals.css chỉ tắt được animation CSS,
    // vòng lặp rAF phải tự dừng ở đây (hình đứng yên ở góc START_ANGLE).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setT((now - start) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const theta = START_ANGLE + (2 * Math.PI * t) / SPIN_PERIOD;
  const s = S_MID + S_AMP * Math.sin((2 * Math.PI * t) / PULSE_PERIOD);

  const box3 = buildBox(s);
  const p = Object.fromEntries(
    Object.entries(SOLID).map(([key, v]) => [key, project(v, theta)]),
  ) as Record<VertexKey, Pt>;
  const b = Object.fromEntries(
    Object.entries(box3).map(([key, v]) => [key, project(v, theta)]),
  ) as Record<BoxKey, Pt>;

  // Mặt bên thứ i = tam giác S + cạnh đáy thứ i (S-A-B, S-B-C, S-C-D, S-D-A).
  const faces = BASE_KEYS.map((key, i) => {
    const tri = [p.S, p[key], p[BASE_KEYS[(i + 1) % 4]]];
    const area = signedArea(tri);
    return { tri, area, visible: area < 0 };
  });
  // Mặt sáng nhất là mặt đang quay thẳng nhất về phía người xem (hình chiếu
  // rộng nhất) — đủ để khối có khối lượng mà không cần tính chiếu sáng thật.
  const widest = Math.max(...faces.map((f) => Math.abs(f.area)), 1);

  const edges: { key: string; from: Pt; to: Pt; solid: boolean }[] = [];
  BASE_KEYS.forEach((key, i) => {
    const next = BASE_KEYS[(i + 1) % 4];
    // Cạnh đáy chỉ thuộc 1 mặt bên (mặt đáy thì luôn khuất vì nhìn từ trên).
    edges.push({ key: `${key}${next}`, from: p[key], to: p[next], solid: faces[i].visible });
    // Cạnh bên thuộc 2 mặt kề — 1 trong 2 mặt hiện là đủ để thấy cạnh.
    edges.push({
      key: `S${key}`,
      from: p.S,
      to: p[key],
      solid: faces[(i + 3) % 4].visible || faces[i].visible,
    });
    // Trung tuyến nằm HẲN trên mặt bên thứ i.
    edges.push({
      key: `S${MID_KEYS[i]}`,
      from: p.S,
      to: p[MID_KEYS[i]],
      solid: faces[i].visible,
    });
  });
  ALWAYS_HIDDEN.forEach(([u, w]) =>
    edges.push({ key: `${u}${w}`, from: p[u], to: p[w], solid: false }),
  );

  const solidEdges = edges.filter((e) => e.solid);
  const dashedEdges = edges.filter((e) => !e.solid);

  const baseFace = BASE_KEYS.map((key) => p[key]);
  const boxTop = [b.M, b.N, b.P, b.Q];
  const boxBottom = [b.X, b.Y, b.Z, b.T];

  return (
    <div
      aria-hidden
      className="relative mx-auto w-full max-w-[26rem] select-none"
    >
      {/* Blob nền tạo chiều sâu cho cả khối minh hoạ */}
      <div className="absolute -top-6 -left-8 -z-10 size-72 rounded-full bg-gradient-to-br from-navy-200/40 to-pastel-200/60 blur-3xl animate-drift" />
      {/* right-4 (không phải right-0): chừa chỗ cho animate-drift phóng to 1.06 */}
      <div
        className="absolute right-4 bottom-0 -z-10 size-64 rounded-full bg-gradient-to-tr from-pastel-400/40 to-navy-100/50 blur-3xl animate-drift"
        style={{ animationDelay: "3s" }}
      />

      <svg
        viewBox="0 0 320 290"
        className="h-auto w-full drop-shadow-[0_18px_40px_rgba(27,42,74,0.18)]"
      >
        <defs>
          <linearGradient id="pyrFace" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="var(--color-pastel-50)" />
            <stop offset="100%" stopColor="var(--color-navy-300)" />
          </linearGradient>
          <radialGradient id="pyrGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-pastel-500)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-pastel-500)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Quầng sáng dưới chân khối, thay cho bóng đổ cứng */}
        <ellipse cx={CX} cy={CY + 34} rx="150" ry="34" fill="url(#pyrGlow)" />

        {/* Mặt đáy: luôn bị chính khối che, tô rất nhạt cho ra chất "nhìn xuyên" */}
        <polygon
          points={toPoints(baseFace)}
          fill="var(--color-pastel-300)"
          fillOpacity="0.3"
        />

        {/* Mặt bên đang hướng về người xem — đậm nhạt theo độ "quay thẳng" */}
        {faces.map((face, i) =>
          face.visible ? (
            <polygon
              key={BASE_KEYS[i]}
              points={toPoints(face.tri)}
              fill="url(#pyrFace)"
              fillOpacity={0.24 + 0.34 * (Math.abs(face.area) / widest)}
            />
          ) : null,
        )}

        {/* Nét khuất của hình chóp */}
        <g
          stroke="var(--color-navy-300)"
          strokeWidth="1.4"
          strokeDasharray="5 5"
          strokeLinecap="round"
        >
          {dashedEdges.map((e) => (
            <line key={e.key} x1={e.from[0]} y1={e.from[1]} x2={e.to[0]} y2={e.to[1]} />
          ))}
        </g>

        {/* Nét thấy của hình chóp */}
        <g
          stroke="var(--color-navy-500)"
          strokeWidth="1.9"
          strokeLinecap="round"
        >
          {solidEdges.map((e) => (
            <line key={e.key} x1={e.from[0]} y1={e.from[1]} x2={e.to[0]} y2={e.to[1]} />
          ))}
        </g>

        {/* Khối hộp nội tiếp: nằm trọn trong lòng chóp nên góc nào cũng khuất
            → toàn nét đứt. Tông accent ấm để tách khỏi nét navy của khung. */}
        <g
          stroke="var(--color-accent-500)"
          strokeWidth="1.6"
          strokeDasharray="5 4"
          strokeLinejoin="round"
          fill="none"
        >
          <polygon
            points={toPoints(boxTop)}
            fill="var(--color-accent-400)"
            fillOpacity="0.24"
          />
          <polygon
            points={toPoints(boxBottom)}
            fill="var(--color-accent-400)"
            fillOpacity="0.16"
          />
          {(["M", "N", "P", "Q"] as const).map((key, i) => {
            const low = (["X", "Y", "Z", "T"] as const)[i];
            return (
              <line
                key={key}
                x1={b[key][0]}
                y1={b[key][1]}
                x2={b[low][0]}
                y2={b[low][1]}
              />
            );
          })}
        </g>

        {/* Chấm đỉnh */}
        <g fill="var(--color-navy-500)">
          {(["S", ...BASE_KEYS] as const).map((key) => (
            <circle key={key} cx={p[key][0]} cy={p[key][1]} r="3.2" />
          ))}
        </g>
        <g fill="var(--color-navy-300)">
          {(["O", ...MID_KEYS] as const).map((key) => (
            <circle key={key} cx={p[key][0]} cy={p[key][1]} r="2.4" />
          ))}
        </g>
        <g fill="var(--color-accent-500)">
          {Object.entries(b).map(([key, [x, y]]) => (
            <circle key={key} cx={x} cy={y} r="2.4" />
          ))}
        </g>

        {/* Nhãn điểm — đặt bằng labelPos nên tự dạt ra ngoài theo góc quay */}
        <g
          fontSize="13"
          fontStyle="italic"
          fontWeight="600"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          <g className="fill-navy-500">
            <Tag name="S" at={labelPos(SOLID.S, theta, 0, -15)} />
            <Tag name="O" at={labelPos(SOLID.O, theta, 0, 15)} />
            {BASE_KEYS.map((key) => (
              <Tag key={key} name={key} at={labelPos(SOLID[key], theta, 16)} />
            ))}
          </g>
          <g className="fill-navy-400">
            {MID_KEYS.map((key) => (
              <Tag key={key} name={key} at={labelPos(SOLID[key], theta, 15)} />
            ))}
          </g>
          <g className="fill-accent-500">
            {(["M", "N", "P", "Q"] as const).map((key) => (
              <Tag key={key} name={key} at={labelPos(box3[key], theta, 11, -10)} />
            ))}
            {(["X", "Y", "Z", "T"] as const).map((key) => (
              <Tag key={key} name={key} at={labelPos(box3[key], theta, 13, 6, true)} />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}

function Tag({ name, at }: { name: string; at: Pt }) {
  return (
    <text x={at[0]} y={at[1]}>
      {name}
    </text>
  );
}
