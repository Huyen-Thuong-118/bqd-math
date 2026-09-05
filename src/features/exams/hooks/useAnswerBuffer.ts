"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerChange } from "../types";

const FLUSH_INTERVAL_MS = 2500;

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export function useAnswerBuffer(
  attemptId: string,
  initialAnswers: Record<number, string>,
  initialHistory: AnswerChange[],
) {
  const [answers, setAnswers] = useState<Record<number, string>>(initialAnswers);
  const [history, setHistory] = useState<AnswerChange[]>(initialHistory);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const pendingRef = useRef<AnswerChange[]>([]);
  const flushingRef = useRef<Promise<boolean> | null>(null);
  const storageKey = `bqd-exam-draft:${attemptId}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const recovered = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Record<number, string> | null;
        if (!recovered) return;
        const changes = Object.entries(recovered).filter(([number, selectedAnswer]) => Number(number) > 0 && typeof selectedAnswer === "string" && initialAnswers[Number(number)] !== selectedAnswer).map(([number, selectedAnswer]) => ({ questionNumber: Number(number), selectedAnswer, changedAt: new Date().toISOString() }));
        if (!changes.length) return;
        setAnswers((current) => ({ ...current, ...recovered })); pendingRef.current.push(...changes); setSaveStatus("unsaved");
      } catch { localStorage.removeItem(storageKey); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialAnswers, storageKey]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (flushingRef.current) return flushingRef.current;
    if (pendingRef.current.length === 0) return true;

    const changes = pendingRef.current.splice(0);
    setSaveStatus("saving");
    const request = fetch(`/api/exams/attempts/${attemptId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, changes }),
      keepalive: true,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? "Không thể lưu đáp án.");
        }
        setSaveStatus(pendingRef.current.length ? "unsaved" : "saved");
        if (pendingRef.current.length === 0) localStorage.removeItem(storageKey);
        return true;
      })
      .catch(() => {
        // Đưa batch lỗi về đầu hàng đợi, giữ đúng thứ tự trước các click mới.
        pendingRef.current = [...changes, ...pendingRef.current];
        setSaveStatus("error");
        return false;
      })
      .finally(() => {
        flushingRef.current = null;
      });

    flushingRef.current = request;
    return request;
  }, [attemptId, storageKey]);

  useEffect(() => {
    const interval = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [flush]);

  useEffect(() => {
    function flushWithBeacon() {
      if (pendingRef.current.length === 0 || !navigator.sendBeacon) return;
      const changes = pendingRef.current;
      const sent = navigator.sendBeacon(
        `/api/exams/attempts/${attemptId}/answers`,
        new Blob([JSON.stringify({ attemptId, changes })], {
          type: "application/json",
        }),
      );
      if (sent) pendingRef.current = [];
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flushWithBeacon();
      else {
        void fetch(`/api/exams/attempts/${attemptId}/answers`, { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((body: { answers?: Record<number, string> } | null) => { if (body?.answers) setAnswers((current) => ({ ...body.answers, ...current })); });
      }
    }

    window.addEventListener("pagehide", flushWithBeacon);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushWithBeacon);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [attemptId]);

  const selectAnswer = useCallback(
    (questionNumber: number, selectedAnswer: string) => {
      const change: AnswerChange = {
        questionNumber,
        selectedAnswer,
        changedAt: new Date().toISOString(),
      };
      setAnswers((current) => ({ ...current, [questionNumber]: selectedAnswer }));
      setHistory((current) => [...current, change]);
      pendingRef.current.push(change);
      try { const stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<number, string>; localStorage.setItem(storageKey, JSON.stringify({ ...stored, [questionNumber]: selectedAnswer })); } catch { /* Trình duyệt có thể chặn localStorage; autosave mạng vẫn hoạt động. */ }
      setSaveStatus("unsaved");
    },
    [storageKey],
  );

  const flushAll = useCallback(async () => {
    // Một request có thể đang chạy trong lúc user vừa chọn thêm đáp án.
    // Lặp cho tới khi hàng đợi rỗng để nút Nộp không vượt qua click cuối.
    while (flushingRef.current || pendingRef.current.length > 0) {
      const saved = await flush();
      if (!saved) return false;
    }
    return true;
  }, [flush]);

  return { answers, history, selectAnswer, flushNow: flushAll, saveStatus };
}
