"use client";

import { useEffect, useState } from "react";

import { computeSessionStatuses, type SessionStatus } from "../schedule-status";
import type { ClassSession } from "../types";

const REFRESH_INTERVAL_MS = 15_000;

export function useSessionStatuses(sessions: ClassSession[]): Map<string, SessionStatus> {
  const [statuses, setStatuses] = useState<Map<string, SessionStatus>>(() => new Map());
  useEffect(() => {
    function tick() {
      setStatuses(computeSessionStatuses(sessions));
    }
    tick();
    const interval = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [sessions]);
  return statuses;
}
