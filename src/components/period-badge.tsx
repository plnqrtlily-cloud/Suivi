import type { TrainingPeriod } from "@/lib/queries";
import { periodColor, focusLabel, weekPosition, periodsOnDate } from "@/lib/periodization";

const LEVEL_LABEL: Record<string, string> = { saison: "Saison", bloc: "Bloc", cycle: "Cycle" };

/**
 * Où en est l'athlète dans sa périodisation, à une date donnée. Affiché au-dessus
 * des calendriers : sans cette ligne, le coach voit des séances mais plus la
 * logique qui les relie. On montre la période la plus fine (le cycle) et son
 * rang de semaine, qui est l'information qui décide du contenu de la séance.
 */
export function PeriodBadge({
  periods,
  date,
  prefix,
}: {
  periods: TrainingPeriod[];
  date: string;
  prefix?: string;
}) {
  const active = periodsOnDate(periods, date);
  if (active.length === 0) return null;
  const finest = active[active.length - 1];
  const pos = weekPosition(finest, date);
  const color = periodColor(finest.focus, finest.color);

  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs">
      {prefix && <span className="text-slate">{prefix}</span>}
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {LEVEL_LABEL[finest.level]}
      </span>
      <span className="font-medium text-ink">{finest.name}</span>
      {finest.focus && <span className="text-slate">{focusLabel(finest.focus)}</span>}
      {pos && (
        <span className={pos.isDeload ? "font-semibold text-gold-light" : "text-slate"}>
          S{pos.week}/{pos.totalWeeks}
          {pos.isDeload ? " · décharge" : ""}
        </span>
      )}
    </span>
  );
}
