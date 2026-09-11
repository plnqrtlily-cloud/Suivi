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

// Carte "hero" pour la séance du jour — cf. exploration design "Idée 2 : carte
// hero séance", retenue par l'utilisateur. Les stats (charge, durée) deviennent
// des badges dans la carte plutôt qu'un tableau séparé, puisqu'elles découlent
// directement de la séance affichée.
export function SessionCard({ workout }: { workout: Workout }) {
  const effortDuration = workout.actual_duration_minutes ?? workout.duration_minutes;
  const charge = workout.rpe && effortDuration ? workout.rpe * effortDuration : null;

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className="block rounded-[22px] bg-status-postponed/10 p-5 transition-colors hover:bg-status-postponed/15"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-status-postponed">
        <SportIcon sport={workout.sport} />
      </div>
      <p className="mt-3.5 text-lg font-bold text-ink">{workout.title}</p>
      <p className="mt-0.5 text-xs font-semibold text-status-postponed">
        {workout.time ? `${workout.time} · ` : ""}
        {sportLabel(workout.sport)}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {workout.duration_minutes && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-soft">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-status-postponed">
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 6v4l3 2" />
            </svg>
            {workout.duration_minutes} min
          </span>
        )}
        {charge !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-soft">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-status-postponed">
              <path d="M11 2L4 12h5l-1 6 8-11h-5l1-5z" />
            </svg>
            {charge} u.a.
          </span>
        )}
      </div>
    </Link>
  );
}
