import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";

import { NotificationReadMarker } from "@/features/notifications/components/NotificationReadMarker";
import { getStudentNotifications } from "@/features/notifications/queries";

export const metadata: Metadata = { title: "Thông báo | BQD Math" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const notifications = await getStudentNotifications();
  const hasUnread = notifications.some((notification) => !notification.readAt);

  return (
    <section className="space-y-6">
      <NotificationReadMarker hasUnread={hasUnread} />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-navy-600">
          <BellRing className="size-6" aria-hidden />
          Thông báo
        </h1>
        <p className="mt-1 text-sm text-navy-300">Tin mới từ các lớp em đang học.</p>
      </div>

      {notifications.length ? (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.href}
              className={`block rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${notification.readAt ? "border-navy-100 bg-white" : "border-pastel-400 bg-pastel-50 shadow-sm"}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${notification.readAt ? "bg-pastel-50 text-navy-300" : "bg-navy-600 text-white"}`}>
                  <Bell className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-navy-600">{notification.title}</h2>
                    {!notification.readAt && <span className="rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-semibold text-green-700">Mới</span>}
                  </div>
                  {notification.className && <p className="mt-1 text-xs font-semibold text-navy-400">{notification.className}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-navy-400">{notification.content}</p>
                  <time className="mt-2 block text-xs text-navy-300">{new Date(notification.sentAt).toLocaleString("vi-VN")}</time>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-navy-100 bg-white p-12 text-center">
          <Bell className="mx-auto size-9 text-navy-200" aria-hidden />
          <p className="mt-3 text-sm text-navy-300">Chưa có thông báo nào.</p>
        </div>
      )}
    </section>
  );
}
