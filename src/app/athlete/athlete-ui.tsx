import Link from "next/link";
import type { Workout } from "@/lib/queries";
import { sportIconPath } from "@/lib/sport-icons";

// Éléments partagés par l'accueil et le calendrier de l'athlète : statuts,
// icône de sport, durée lisible et carte d'élément (séance, ajout…).
const PET = "#1b4b4f";

export function isGoal(w: Workout) {
  return w.category === "objectif" || w.category === "evenement";
}

export function durationLabel(min: number | null) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

export const STATUS_CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  todo: { label: "À faire", bg: "#e6eae9", fg: "#5b6660" },
  noreturn: { label: "Pas de retour", bg: "#fbe3da", fg: "#a4492a" },
  done: { label: "Faite", bg: "#dfeceb", fg: PET },
  not_done: { label: "Pas faite", bg: "#e6eae9", fg: "#5b6660" },
  postponed: { label: "Reportée", bg: "#fbf1dc", fg: "#7a5a14" },
};
export function statusKey(w: Workout, today: string) {
  if (w.status === "done" || w.status === "partial") return "done";
  if (w.status === "not_done") return "not_done";
  if (w.status === "postponed") return "postponed";
  return w.date < today ? "noreturn" : "todo";
}
export function Chip({ k }: { k: string }) {
  const c = STATUS_CHIP[k];
  return (
    <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: c.bg, color: c.fg }}>
      {c.label}
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

