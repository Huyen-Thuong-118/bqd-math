"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";

export function ExamTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: string | null;
  onExpire: () => void;
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)) : null,
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!expiresAt) return;
    function update() {
      const next = Math.max(0, Math.ceil((Date.parse(expiresAt!) - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    }
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (remainingSeconds === null) return <span>Không giới hạn thời gian</span>;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return (
    <span
      className={`inline-flex items-center gap-2 font-semibold ${remainingSeconds <= 60 ? "text-red-600" : "text-navy-600"}`}
    >
      <Clock3 className="size-4" aria-hidden />
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
