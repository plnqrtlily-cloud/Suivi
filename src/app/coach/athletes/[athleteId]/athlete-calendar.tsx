import Link from "next/link";
import { getWorkoutsForAthlete, getImportedActivitiesForRange, getAvailabilityBlocksForRange } from "@/lib/queries";
import { getWeekDates, getMonthGrid, monthLabel } from "@/lib/dates";
import { AVAILABILITY_SLOT_LABELS, resolveTimeForSort, formatWorkoutTime } from "@/lib/time-of-day";
import { StatusBadge, sportLabel } from "@/components/ui";
import { sportIconPath } from "@/lib/sport-icons";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

// Regroupe séances à venir, séances récentes et activités importées de
// l'athlète dans un seul calendrier (semaine/mois) — vue "programmée"
// plutôt que trois listes plates séparées. Lecture seule côté coach : les
// entrées renvoient vers le détail de la séance, les indisponibilités
// posées par l'athlète s'affichent pour planifier autour.
export async function AthleteCalendar({
  athleteId,
  view,
  week,
  month,
  today,
}: {
  athleteId: string;
  view?: string;
  week?: string;
  month?: string;
  today: string;
}) {
  const activeView = view === "month" ? "month" : "week";
  const base = `/coach/athletes/${athleteId}`;

  return (
    <div>
      <div className="mb-4 flex rounded-2xl bg-paper-dim p-1">
        <Link
          href={`${base}?view=week`}
          className={`flex-1 rounded-xl py-2 text-center text-sm font-semibold transition-colors ${
            activeView === "week" ? "bg-white text-ink shadow-sm" : "text-slate"
          }`}
        >
          Semaine
        </Link>
        <Link
          href={`${base}?view=month`}
          className={`flex-1 rounded-xl py-2 text-center text-sm font-semibold transition-colors ${
            activeView === "month" ? "bg-white text-ink shadow-sm" : "text-slate"
          }`}
        >
          Mois
        </Link>
      </div>

      {activeView === "week" ? (
        <CoachWeekView athleteId={athleteId} offset={week ? Number(week) : 0} today={today} base={base} />
      ) : (
        <CoachMonthView athleteId={athleteId} monthParam={month} today={today} base={base} />
      )}
    </div>
  );
}

async function CoachWeekView({ athleteId, offset, today, base }: { athleteId: string; offset: number; today: string; base: string }) {
  const weekDates = getWeekDates(offset);
  const [workouts, imports, blocks] = await Promise.all([
    getWorkoutsForAthlete(athleteId, weekDates[0], weekDates[6]),
    getImportedActivitiesForRange(athleteId, weekDates[0], weekDates[6]),
    getAvailabilityBlocksForRange(athleteId, weekDates[0], weekDates[6]),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href={`${base}?view=week&week=${offset - 1}`} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ‹
        </Link>
        <p className="text-sm font-semibold text-ink-soft">
          Semaine du {weekDates[0].slice(8, 10)} au {weekDates[6].slice(8, 10)}{" "}
          {new Date(`${weekDates[6]}T00:00:00`).toLocaleDateString("fr-FR", { month: "long" })}
        </p>
        <Link href={`${base}?view=week&week=${offset + 1}`} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ›
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {weekDates.map((date, idx) => {
          const dayWorkouts = workouts.filter((w) => w.date === date).sort((a, b) => resolveTimeForSort(a.time).localeCompare(resolveTimeForSort(b.time)));
          const dayImports = imports.filter((a) => a.activity_date === date);
          const dayBlocks = blocks.filter((b) => b.date === date);
          const isToday = date === today;

          return (
            <div key={date} className={`rounded-2xl border p-4 ${isToday ? "border-gold-light bg-gold-light/5" : "border-line bg-white"}`}>
              <Link href={`${base}/day/${date}`} className="mb-2 flex items-center gap-2 hover:underline">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-[13px] font-semibold ${isToday ? "bg-gold-light text-white" : "bg-paper-dim text-ink"}`}>
                  {date.slice(8, 10)}
                </span>
                <span className="text-sm font-semibold text-ink">{DAY_LABELS[idx]}</span>
              </Link>

              {dayBlocks.length > 0 && (
                <div className="mb-2 flex flex-col gap-1.5 pl-9">
                  {dayBlocks.map((b) => (
                    <div key={b.id} className="flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white">
                      <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                        <rect x="4" y="9" width="12" height="8" rx="1.5" />
                        <path d="M7 9V6a3 3 0 016 0v3" />
                      </svg>
                      <b className="font-semibold">{AVAILABILITY_SLOT_LABELS[b.time_of_day]}</b>
                      {b.reason && <span className="truncate text-white/70">— {b.reason}</span>}
                    </div>
                  ))}
                </div>
              )}

              {dayWorkouts.length === 0 && dayImports.length === 0 ? (
                <p className="pl-9 text-xs text-slate">Rien de prévu</p>
              ) : (
                <div className="flex flex-col gap-1.5 pl-9">
                  {dayWorkouts.map((w) => (
                    <Link key={w.id} href={`/workouts/${w.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
                        <span className="truncate text-ink">{w.title}</span>
                        <span className="flex-shrink-0 text-xs text-slate">
                          {w.time ? `${formatWorkoutTime(w.time)} · ` : ""}
                          {sportLabel(w.sport)}
                        </span>
                      </span>
                      <StatusBadge status={w.status} />
                    </Link>
                  ))}
                  {dayImports.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-clay" />
                      <span className="text-ink-soft">{sportLabel(a.sport)}</span>
                      <span className="text-xs text-slate">
                        {a.duration_minutes ? `${a.duration_minutes} min · ` : ""}
                        activité importée
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function CoachMonthView({ athleteId, monthParam, today, base }: { athleteId: string; monthParam?: string; today: string; base: string }) {
  const now = new Date();
  const [year, month] = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const grid = getMonthGrid(year, month);
  const [workouts, blocks] = await Promise.all([
    getWorkoutsForAthlete(athleteId, grid[0].date, grid[grid.length - 1].date),
    getAvailabilityBlocksForRange(athleteId, grid[0].date, grid[grid.length - 1].date),
  ]);

  function prevMonth() {
    const d = new Date(year, month - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function nextMonth() {
    const d = new Date(year, month, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href={`${base}?view=month&month=${prevMonth()}`} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ‹
        </Link>
        <p className="text-sm font-semibold capitalize text-ink-soft">{monthLabel(year, month)}</p>
        <Link href={`${base}?view=month&month=${nextMonth()}`} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ›
        </Link>
      </div>

      <div className="mb-2 grid grid-cols-7 px-1">
        {DAY_LETTERS.map((l, i) => (
          <span key={i} className="text-center text-[10px] uppercase text-slate">
            {l}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-3">
        {grid.map((cell) => {
          const dayWorkouts = workouts.filter((w) => w.date === cell.date);
          const hasGoal = dayWorkouts.some((w) => w.category === "objectif" || w.category === "evenement");
          const trainingWorkouts = dayWorkouts.filter((w) => w.category !== "objectif" && w.category !== "evenement");
          const primaryTraining = trainingWorkouts[0];
          const hasBlock = blocks.some((b) => b.date === cell.date);
          const isToday = cell.date === today;

          return (
            <Link key={cell.date} href={`${base}/day/${cell.date}`} className="flex flex-col items-center gap-1 py-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold ${
                  isToday ? "bg-gold-light text-white" : cell.inMonth ? "text-ink hover:bg-paper-dim" : "text-line"
                }`}
              >
                {cell.day}
              </span>
              <span className="flex h-3.5 items-center gap-1">
                {primaryTraining ? (
                  <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke={primaryTraining.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={sportIconPath(primaryTraining.sport)} />
                  </svg>
                ) : (
                  <span className="h-1.5 w-1.5" />
                )}
                {hasGoal && <span className="h-1.5 w-1.5 rounded-sm bg-gold-light" />}
                {hasBlock && <span className="h-1.5 w-1.5 rounded-sm bg-ink" />}
                {trainingWorkouts.length > 1 && <span className="text-[8px] font-bold leading-none text-slate">+{trainingWorkouts.length - 1}</span>}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-line pt-4 text-[11px] text-slate">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-moss" /> Séance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-sm bg-gold-light" /> Objectif / échéance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-sm bg-ink" /> Indisponibilité athlète
        </span>
      </div>
    </div>
  );
}
