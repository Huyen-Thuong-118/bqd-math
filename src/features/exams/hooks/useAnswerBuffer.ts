"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerChange } from "../types";

const FLUSH_INTERVAL_MS = 2500;

/**
 * Hook quản lý việc chọn đáp án trong lúc thi.
 *
 * VÌ SAO CẦN HOOK NÀY (thay vì gọi API mỗi lần HS click chọn đáp án):
 * 500 HS thi cùng lúc, mỗi người đổi đáp án nhiều lần -> nếu ghi DB ngay
 * mỗi click sẽ tạo hàng nghìn request/giây dồn vào cùng lúc, dễ làm cạn
 * connection pool. Hook này:
 *   1. Cập nhật UI NGAY LẬP TỨC (không đợi server) — lịch sử hiện dưới
 *      câu hỏi vẫn đúng yêu cầu, chỉ là lưu server trễ vài giây.
 *   2. Gộp nhiều lần đổi đáp án thành 1 request, gửi mỗi ~2.5s.
 *   3. Dùng navigator.sendBeacon khi HS đóng tab / chuyển tab để không
 *      mất dữ liệu chưa kịp flush theo lịch.
 *
 * Xem ARCHITECTURE.md mục "500 người thi cùng lúc" để biết lý do thiết kế.
 */
export function useAnswerBuffer(attemptId: string) {
  // Đáp án hiện tại của từng câu — dùng render UI (câu nào đã chọn gì)
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Toàn bộ lịch sử đổi đáp án — dùng render <AnswerHistory /> ngay lập tức
  const [history, setHistory] = useState<AnswerChange[]>([]);

  // Hàng đợi các thay đổi CHƯA gửi lên server — không dùng state vì không
  // cần re-render khi hàng đợi đổi, chỉ cần đọc lúc flush.
  const pendingRef = useRef<AnswerChange[]>([]);

  const flush = useCallback(
    (useBeacon = false) => {
      if (pendingRef.current.length === 0) return;

      const payload = JSON.stringify({
        attemptId,
        changes: pendingRef.current,
      });
      pendingRef.current = [];

      const url = `/api/exams/attempts/${attemptId}/answers`;

      if (useBeacon && navigator.sendBeacon) {
        // sendBeacon: gửi "cố gắng tốt nhất", không chờ phản hồi — an toàn
        // khi gọi lúc trang đang đóng (fetch thường bị trình duyệt huỷ giữa chừng).
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true, // giữ request sống thêm chút nếu trang đang chuyển hướng
        }).catch(() => {
          // TODO: nếu fail, đẩy lại vào pendingRef để thử ở lần flush sau
        });
      }
    },
    [attemptId]
  );

  // Flush định kỳ mỗi FLUSH_INTERVAL_MS
  useEffect(() => {
    const interval = setInterval(() => flush(false), FLUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [flush]);

  // Flush khi HS rời trang / chuyển tab — tránh mất đáp án chưa kịp lưu
  useEffect(() => {
    const handleUnload = () => flush(true);
    window.addEventListener("pagehide", handleUnload);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush(true);
    });
    return () => window.removeEventListener("pagehide", handleUnload);
  }, [flush]);

  const selectAnswer = useCallback((questionNumber: number, selectedAnswer: string) => {
    const change: AnswerChange = {
      questionNumber,
      selectedAnswer,
      changedAt: new Date().toISOString(),
    };

    setAnswers((prev) => ({ ...prev, [questionNumber]: selectedAnswer }));
    setHistory((prev) => [...prev, change]);
    pendingRef.current.push(change);
  }, []);

  return { answers, history, selectAnswer, flushNow: () => flush(false) };
}
