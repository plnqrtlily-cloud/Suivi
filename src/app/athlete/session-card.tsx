import Link from "next/link";
import { sportLabel } from "@/components/ui";
import { Workout } from "@/lib/queries";
import { sportIconPath } from "@/lib/sport-icons";
import { formatWorkoutTime } from "@/lib/time-of-day";

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

// Jeu d'icônes partagé avec le reste de l'app (@/lib/sport-icons) plutôt
// qu'un second jeu dessiné localement : évitait la duplication mais faisait
// diverger le pictogramme "autre" (et le style général) de cet écran par
// rapport aux autres vues.
function SportIcon({ sport }: { sport: string }) {
  return (
    <svg {...ICON_PROPS}>
      <path d={sportIconPath(sport)} />
    </svg>
  );
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
          {workout.time ? `${formatWorkoutTime(workout.time)} · ` : ""}
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
