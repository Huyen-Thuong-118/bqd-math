"use client";

import { useEffect } from "react";

import { markAllNotificationsRead } from "../actions";

export function NotificationReadMarker({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (hasUnread) void markAllNotificationsRead();
  }, [hasUnread]);
  return null;
}
