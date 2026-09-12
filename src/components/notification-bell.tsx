"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/lib/actions";
import type { Notification } from "@/lib/notifications";

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: "0 0 20 20",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "new_workout":
      return (
        <svg {...ICON_PROPS}>
          <rect x="3" y="4.5" width="14" height="12" rx="2" />
          <path d="M3 8.5h14" />
          <path d="M6.5 2.5v3M13.5 2.5v3" />
        </svg>
      );
    case "workout_cancelled":
      return (
        <svg {...ICON_PROPS}>
          <circle cx="10" cy="10" r="7.5" />
          <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />
        </svg>
      );
    case "workout_updated":
      return (
        <svg {...ICON_PROPS}>
          <path d="M13.5 3.5l3 3L7 16l-4 1 1-4z" />
        </svg>
      );
    case "comment":
      return (
        <svg {...ICON_PROPS}>
          <path d="M3 5.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.5 3v-3H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "event_reminder":
      return (
        <svg {...ICON_PROPS}>
          <path d="M4 17V3M4 3h11l-2 3.5L15 10H4" />
        </svg>
      );
    default:
      return null;
  }
}

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
        className="relative flex items-center text-ink-soft hover:text-ink"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8a5 5 0 0110 0c0 4 1.5 5 1.5 5h-13S5 12 5 8z" />
          <path d="M8 16a2 2 0 004 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate">Notifications</p>
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
                <p className="flex items-center gap-1.5 text-ink">
                  <span className="text-ink-soft"><TypeIcon type={n.type} /></span>
                  {n.title}
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
