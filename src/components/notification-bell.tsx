"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/lib/actions";
import type { Notification } from "@/lib/notifications";

const TYPE_ICONS: Record<string, string> = {
  new_workout: "📅",
  workout_cancelled: "🚫",
  comment: "💬",
  event_reminder: "🏁",
};

export function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleOpenNotification(n: Notification) {
    if (!n.read_at) await markNotificationReadAction(n.id);
    setOpen(false);
    router.refresh();
  }

  async function handleMarkAllRead() {
    await markAllNotificationsReadAction();
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative text-ink-soft hover:text-ink"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-md border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-medium text-ink">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs text-moss-dark underline">
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && <p className="px-3 py-4 text-sm text-slate">Rien pour l&apos;instant.</p>}
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link || "#"}
                onClick={() => handleOpenNotification(n)}
                className={`block border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-paper-dim ${
                  !n.read_at ? "bg-moss/5" : ""
                }`}
              >
                <p className="text-ink">
                  {TYPE_ICONS[n.type]} {n.title}
                </p>
                {n.body && <p className="mt-0.5 text-xs text-slate">{n.body}</p>}
                <p className="mt-0.5 text-xs text-slate">{n.created_at.slice(0, 16)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
