import Link from "next/link";
import { sportLabel } from "@/components/ui";
import { Workout } from "@/lib/queries";

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 20 20",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function SportIcon({ sport }: { sport: string }) {
  switch (sport) {
    case "running":
      return (
        <svg {...ICON_PROPS}>
          <circle cx="13" cy="4" r="1.6" />
          <path d="M7 18l2-5 3 1 2-5-3-2-2 2-3-1" />
        </svg>
      );
    case "cycling":
      return (
        <svg {...ICON_PROPS}>
          <circle cx="5.5" cy="14.5" r="2.7" />
          <circle cx="14.5" cy="14.5" r="2.7" />
          <path d="M5.5 14.5l3-6.5h4l2.5 4.5h2M8.5 8h2" />
        </svg>
      );
    case "hiking":
      return (
        <svg {...ICON_PROPS}>
          <path d="M2 16l5-9 3 5 2-3 6 7H2z" />
        </svg>
      );
    case "swimming":
      return (
        <svg {...ICON_PROPS}>
          <circle cx="15" cy="5" r="1.5" />
          <path d="M2 15c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0" />
        </svg>
      );
    case "climbing":
      return (
        <svg {...ICON_PROPS}>
          <circle cx="8" cy="5" r="1.3" />
          <path d="M2 17l6-12 4 7 2-3 4 8H2z" />
        </svg>
      );
    case "strength":
      return (
        <svg {...ICON_PROPS}>
          <path d="M4 10v4M2 9v6M16 9v6M18 10v4M6 12h10" />
        </svg>
      );
    default:
      return (
        <svg {...ICON_PROPS}>
          <path d="M10 2v4M10 14v4M2 10h4M14 10h4M4.9 4.9l2.8 2.8M12.3 12.3l2.8 2.8M15.1 4.9l-2.8 2.8M7.7 12.3l-2.8 2.8" />
        </svg>
      );
  }
}

// Ligne discrète pour la séance du jour — "Piste A" des propositions
// (liseré coloré + icône + titre/méta + chevron), retenue par l'utilisateur
// à la place de l'ancienne carte hero : plus compacte, laisse de la place au
// reste de l'écran d'accueil.
export function SessionCard({ workout }: { workout: Workout }) {
  const effortDuration = workout.actual_duration_minutes ?? workout.duration_minutes;
  const charge = workout.rpe && effortDuration ? workout.rpe * effortDuration : null;

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className="flex items-center gap-3 rounded-2xl border border-line bg-white py-3 pl-0 pr-3.5 transition-colors hover:border-moss"
    >
      <span className="w-[3px] flex-shrink-0 self-stretch rounded-full" style={{ backgroundColor: workout.color }} />
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-paper-dim text-ink-soft">
        <SportIcon sport={workout.sport} />
      </span>
      <span className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-ink">{workout.title}</p>
        <p className="mt-0.5 truncate text-xs text-slate">
          {workout.time ? `${workout.time} · ` : ""}
          {sportLabel(workout.sport)}
          {workout.duration_minutes ? ` · ${workout.duration_minutes} min` : ""}
          {charge !== null ? ` · ${charge} u.a.` : ""}
        </p>
      </span>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-slate">
        <path d="M7 5l6 5-6 5" />
      </svg>
    </Link>
  );
}
