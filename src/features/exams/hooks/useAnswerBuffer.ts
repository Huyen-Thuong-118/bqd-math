"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerChange } from "../types";

const FLUSH_INTERVAL_MS = 2500;
const MAX_CHANGES_PER_BATCH = 100;

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

function createEventId() {
  return crypto.randomUUID().replaceAll("-", "");
}

function readQueue(key: string): AnswerChange[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is AnswerChange =>
        Boolean(item) &&
        typeof item.eventId === "string" &&
        Number.isInteger(item.questionNumber) &&
        (typeof item.selectedAnswer === "string" || item.selectedAnswer === null) &&
        typeof item.changedAt === "string",
    );
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

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
  const queueKey = `bqd-exam-events:${attemptId}`;

  const persistQueue = useCallback(() => {
    try {
      if (pendingRef.current.length === 0) localStorage.removeItem(queueKey);
      else localStorage.setItem(queueKey, JSON.stringify(pendingRef.current));
    } catch {}
  }, [queueKey]);

  useEffect(() => {
    const recovered = readQueue(queueKey);
    if (recovered.length === 0) return;
    pendingRef.current = recovered;
    setAnswers((current) => {
      const next = { ...current };
      for (const change of recovered) {
        if (change.selectedAnswer === null) delete next[change.questionNumber];
        else next[change.questionNumber] = change.selectedAnswer;
      }
      return next;
    });
    setHistory((current) => [...current, ...recovered]);
    setSaveStatus("unsaved");
  }, [queueKey]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (flushingRef.current) return flushingRef.current;
    if (pendingRef.current.length === 0) return true;

    const changes = pendingRef.current.slice(0, MAX_CHANGES_PER_BATCH);
    setSaveStatus("saving");
    const request = fetch(`/api/exams/attempts/${attemptId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, changes }),
      keepalive: true,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | { error?: string; acknowledgedEventIds?: string[] }
          | null;
        if (!response.ok || !body?.acknowledgedEventIds) {
          throw new Error(body?.error ?? "Không thể lưu đáp án.");
        }
        const acknowledged = new Set(body.acknowledgedEventIds);
        pendingRef.current = pendingRef.current.filter(
          (change) => !acknowledged.has(change.eventId),
        );
        persistQueue();
        setSaveStatus(pendingRef.current.length ? "unsaved" : "saved");
        return true;
      })
      .catch(() => {
        persistQueue();
        setSaveStatus("error");
        return false;
      })
      .finally(() => {
        flushingRef.current = null;
      });

    flushingRef.current = request;
    return request;
  }, [attemptId, persistQueue]);

  useEffect(() => {
    const interval = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [flush]);

  useEffect(() => {
    const flushDurably = () => {
      persistQueue();
      void flush();
    };
    const synchronize = () => {
      if (document.visibilityState === "visible") void flush();
    };
    window.addEventListener("pagehide", flushDurably);
    document.addEventListener("visibilitychange", synchronize);
    return () => {
      window.removeEventListener("pagehide", flushDurably);
      document.removeEventListener("visibilitychange", synchronize);
    };
  }, [flush, persistQueue]);

  const selectAnswer = useCallback(
    (questionNumber: number, selectedAnswer: string | null) => {
      const change: AnswerChange = {
        eventId: createEventId(),
        questionNumber,
        selectedAnswer,
        changedAt: new Date().toISOString(),
      };
      setAnswers((current) => {
        const next = { ...current };
        if (selectedAnswer === null) delete next[questionNumber];
        else next[questionNumber] = selectedAnswer;
        return next;
      });
      setHistory((current) => [...current, change]);
      pendingRef.current.push(change);
      persistQueue();
      setSaveStatus("unsaved");
    },
    [persistQueue],
  );

  const flushAll = useCallback(async () => {
    while (flushingRef.current || pendingRef.current.length > 0) {
      const saved = await flush();
      if (!saved) return false;
    }
    return true;
  }, [flush]);

  return { answers, history, selectAnswer, flushNow: flushAll, saveStatus };
}
