import Link from "next/link";
import type { Workout } from "@/lib/queries";
import { sportIconPath } from "@/lib/sport-icons";
import { SESSION_TONES, type StatusIconName } from "@/lib/session-status";
import { StatusIcon } from "@/components/status-icon";

// Éléments partagés par l'accueil et le calendrier de l'athlète : statuts,
// icône de sport, durée lisible et carte d'élément (séance, ajout…).

export function isGoal(w: Workout) {
  return w.category === "objectif" || w.category === "evenement";
}

export function durationLabel(min: number | null) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

// Statut repéré par une icône (cf. src/lib/session-status.ts) : flèche à
// faire, sablier faite (en attente de validation), coche validée, croix pas faite.
const T = SESSION_TONES;
export const STATUS_CHIP: Record<string, { label: string; bg: string; fg: string; icon: StatusIconName }> = {
  todo: T.todo,
  noreturn: T.noreport,
  done: T.done,
  validated: T.validated,
  not_done: T.missed,
  postponed: T.postponed,
  hors: T.hors,
};
export function statusKey(w: Workout, today: string) {
  if (w.status === "done" || w.status === "partial") return w.coach_validated_at ? "validated" : "done";
  if (w.status === "not_done") return "not_done";
  if (w.status === "postponed") return "postponed";
  return w.date < today ? "noreturn" : "todo";
}
export function Chip({ k }: { k: string }) {
  const c = STATUS_CHIP[k];
  return (
    <span
      title={c.label}
      aria-label={c.label}
      role="img"
      className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: c.bg, color: c.fg }}
    >
      <StatusIcon name={c.icon} size={15} />
    </span>
  );
}

export function SportIcon({ sport, size = 20 }: { sport: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={sportIconPath(sport)} />
    </svg>
  );
}

export function ItemCard({
  chip,
  by,
  icon,
  iconColor,
  title,
  sub,
  href,
  actions,
}: {
  chip: React.ReactNode;
  by: string;
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  sub: string;
  href?: string;
  actions?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-paper-dim" style={{ color: iconColor }}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-[15px] font-semibold text-ink">{title}</b>
        <span className="truncate text-[12.5px] text-slate">{sub}</span>
      </span>
    </>
  );
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white px-3.5 py-3">
      <div className="flex items-center gap-2">
        {chip}
        <span className="flex-1" />
        <span className="text-xs text-slate">{by}</span>
      </div>
      <div className="flex items-center gap-3">
        {href ? (
          <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
            {body}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
        )}
        {actions ?? (
          href && (
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#5b6660" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 5l5 5-5 5" />
            </svg>
          )
        )}
      </div>
    </div>
  );
}

