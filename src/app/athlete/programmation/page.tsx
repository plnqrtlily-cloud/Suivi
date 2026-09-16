import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutsForAthlete, getImportedActivitiesForRange, getAvailabilityBlocksForRange } from "@/lib/queries";
import { getWeekDates, getMonthGrid, monthLabel, todayISO, toISODate, type MonthCell } from "@/lib/dates";
import { AVAILABILITY_SLOT_LABELS } from "@/lib/time-of-day";
import { Nav } from "@/components/nav";
import { sportLabel, StatusBadge } from "@/components/ui";
import { sportIconPath } from "@/lib/sport-icons";
import { DayLink } from "@/components/day-link";
import { DeleteAvailabilityButton } from "@/components/delete-availability-button";
import { SnapScrollNav } from "@/components/snap-scroll-nav";
import { EditAvailabilityModal } from "@/components/availability-modal";
import { CalendarAddButton } from "./calendar-add-button";
import type { AvailabilityBlock, Workout } from "@/lib/queries";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

function shiftMonth(year: number, month: number, delta: number): [number, number] {
  const d = new Date(year, month - 1 + delta, 1);
  return [d.getFullYear(), d.getMonth() + 1];
}
function monthParamStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Complète à 6 semaines (42 cases) les mois qui n'en comptent que 5, pour que
// les trois panneaux (précédent/courant/suivant) du défilement continu aient
// toujours exactement la même hauteur — sans quoi les points d'ancrage du
// scroll-snap ne tomberaient pas aux mêmes positions d'un panneau à l'autre.
// Hauteur d'un panneau de mois, déduite du gabarit d'une ligne plutôt que
// codée en dur : une valeur figée (336 px) coupait la dernière ligne de
// chiffres, la grille faisant toujours 6 semaines une fois complétée.
// Par ligne : py-1 (2×4) + pastille h-7 (28) + gap-1 (4) + pastilles h-3.5 (14).
const MONTH_ROW_HEIGHT = 8 + 28 + 4 + 14; // 54 px
const MONTH_ROW_GAP = 12; // gap-y-3
const MONTH_ROWS = 6; // padGridTo42 garantit 42 cases = 6 semaines
const MONTH_PANE_HEIGHT = MONTH_ROWS * MONTH_ROW_HEIGHT + (MONTH_ROWS - 1) * MONTH_ROW_GAP;

function padGridTo42(grid: MonthCell[]): MonthCell[] {
  if (grid.length >= 42) return grid;
  const extra: MonthCell[] = [];
  const last = new Date(`${grid[grid.length - 1].date}T00:00:00`);
  for (let i = 1; i <= 42 - grid.length; i++) {
    const d = new Date(last);
    d.setDate(d.getDate() + i);
    extra.push({ date: toISODate(d), day: d.getDate(), inMonth: false });
  }
  return [...grid, ...extra];
}

// Le contenu d'un panneau du défilement continu façon calendrier Apple : la
// grille de jours d'un seul mois, sans l'en-tête (jours de la semaine, flèches)
// qui reste commune aux trois panneaux.
function MonthGridBody({ grid, workouts, blocks, today }: { grid: MonthCell[]; workouts: Workout[]; blocks: AvailabilityBlock[]; today: string }) {
  return (
    <div className="grid grid-cols-7 gap-y-3">
      {grid.map((cell) => {
        const dayWorkouts = workouts.filter((w) => w.date === cell.date);
        const hasGoal = dayWorkouts.some((w) => w.category === "objectif" || w.category === "evenement");
        const hasBlock = blocks.some((b) => b.date === cell.date);
        const isToday = cell.date === today;
        const trainingWorkouts = dayWorkouts.filter((w) => w.category !== "objectif" && w.category !== "evenement");
        const primaryTraining = trainingWorkouts[0];
        const extraTrainingCount = trainingWorkouts.length - (primaryTraining ? 1 : 0);
        const extraCount = extraTrainingCount + (hasGoal ? 0 : 0);

        return (
          <DayLink key={cell.date} href={`/athlete/day/${cell.date}`} className="flex flex-col items-center gap-1 py-1">
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
              {extraCount > 0 && <span className="text-[8px] font-bold leading-none text-slate">+{extraCount}</span>}
            </span>
          </DayLink>
        );
      })}
    </div>
  );
}

export default async function ProgrammationPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach");

  const { view, week, month } = await searchParams;
  const activeView = view === "month" ? "month" : "week";
  const today = todayISO();

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-3xl text-ink">Calendrier</h1>
          {/* Point d'entrée unique : séance faite hors programmation OU
              indisponibilité — les deux se rattachent à un jour du calendrier. */}
          <CalendarAddButton defaultDate={today} />
        </div>

        <div className="mb-6 flex rounded-2xl bg-paper-dim p-1">
          <Link
            href="/athlete/programmation?view=week"
            className={`flex-1 rounded-xl py-2 text-center text-sm font-semibold transition-colors ${
              activeView === "week" ? "bg-white text-ink shadow-sm" : "text-slate"
            }`}
          >
            Semaine
          </Link>
          <Link
            href="/athlete/programmation?view=month"
            className={`flex-1 rounded-xl py-2 text-center text-sm font-semibold transition-colors ${
              activeView === "month" ? "bg-white text-ink shadow-sm" : "text-slate"
            }`}
          >
            Mois
          </Link>
        </div>

        {activeView === "week" ? (
          <WeekView athleteId={user.id} offset={week ? Number(week) : 0} today={today} />
        ) : (
          <MonthView athleteId={user.id} monthParam={month} today={today} />
        )}
      </main>
    </div>
  );
}

async function WeekView({ athleteId, offset, today }: { athleteId: string; offset: number; today: string }) {
  const weekDates = getWeekDates(offset);
  const [workouts, imports, blocks] = await Promise.all([
    getWorkoutsForAthlete(athleteId, weekDates[0], weekDates[6]),
    getImportedActivitiesForRange(athleteId, weekDates[0], weekDates[6]),
    getAvailabilityBlocksForRange(athleteId, weekDates[0], weekDates[6]),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/athlete/programmation?view=week&week=${offset - 1}`} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ‹
        </Link>
        <p className="text-sm font-semibold text-ink-soft">
          Semaine du {weekDates[0].slice(8, 10)} au {weekDates[6].slice(8, 10)}{" "}
          {new Date(`${weekDates[6]}T00:00:00`).toLocaleDateString("fr-FR", { month: "long" })}
        </p>
        <Link href={`/athlete/programmation?view=week&week=${offset + 1}`} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ›
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {weekDates.map((date, idx) => {
          const dayWorkouts = workouts.filter((w) => w.date === date).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
          const dayImports = imports.filter((a) => a.activity_date === date);
          const dayBlocks = blocks.filter((b) => b.date === date);
          const totalMinutes = dayWorkouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);
          const isToday = date === today;

          return (
            <div key={date} className={`rounded-2xl border p-4 ${isToday ? "border-gold-light bg-gold-light/5" : "border-line bg-white"}`}>
              <div className="mb-2 flex items-center justify-between">
                <DayLink href={`/athlete/day/${date}`} className="flex items-center gap-2 hover:underline">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-[13px] font-semibold ${isToday ? "bg-gold-light text-white" : "bg-paper-dim text-ink"}`}>
                    {date.slice(8, 10)}
                  </span>
                  <span className="text-sm font-semibold text-ink">{DAY_LABELS[idx]}</span>
                </DayLink>
                {totalMinutes > 0 && (
                  <span className="text-[11px] font-semibold text-slate">
                    {Math.floor(totalMinutes / 60) > 0 ? `${Math.floor(totalMinutes / 60)}h` : ""}
                    {totalMinutes % 60 > 0 ? `${totalMinutes % 60}` : ""} prévues
                  </span>
                )}
              </div>

              {dayBlocks.length > 0 && (
                <div className="mb-2 flex flex-col gap-1.5 pl-9">
                  {dayBlocks.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink px-2.5 py-1.5 text-white">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs">
                        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                          <rect x="4" y="9" width="12" height="8" rx="1.5" />
                          <path d="M7 9V6a3 3 0 016 0v3" />
                        </svg>
                        <b className="font-semibold">{AVAILABILITY_SLOT_LABELS[b.time_of_day]}</b>
                        {b.reason && <span className="truncate text-white/70">— {b.reason}</span>}
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-2">
                        <EditAvailabilityModal block={b} className="text-white/50 hover:text-white" />
                        <DeleteAvailabilityButton id={b.id} className="text-white/50 hover:text-white" />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {dayWorkouts.length === 0 && dayImports.length === 0 ? (
                dayBlocks.length === 0 && <p className="pl-9 text-xs text-slate">Repos</p>
              ) : (
                <div className="flex flex-col gap-1.5 pl-9">
                  {dayWorkouts.map((w) => (
                    <Link key={w.id} href={`/workouts/${w.id}`} className="flex flex-wrap items-center gap-2 text-sm hover:underline">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
                      <span className="text-ink">{w.title}</span>
                      <span className="text-xs text-slate">
                        {w.time ? `${w.time} · ` : ""}
                        {sportLabel(w.sport)}
                      </span>
                      {w.status !== "planned" && <StatusBadge status={w.status} />}
                    </Link>
                  ))}
                  {dayImports.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-clay" />
                      <span className="text-ink-soft">{sportLabel(a.sport)}</span>
                      <span className="text-xs text-slate">activité importée</span>
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

async function MonthView({ athleteId, monthParam, today }: { athleteId: string; monthParam?: string; today: string }) {
  const now = new Date();
  const [year, month] = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const [prevYear, prevMonthNum] = shiftMonth(year, month, -1);
  const [nextYear, nextMonthNum] = shiftMonth(year, month, 1);

  const grid = padGridTo42(getMonthGrid(year, month));
  const prevGrid = padGridTo42(getMonthGrid(prevYear, prevMonthNum));
  const nextGrid = padGridTo42(getMonthGrid(nextYear, nextMonthNum));

  // Une seule requête pour les trois mois (plutôt que trois allers-retours par
  // type de donnée) : la plage couvre du premier jour affiché du panneau
  // précédent au dernier jour affiché du panneau suivant.
  const rangeStart = prevGrid[0].date;
  const rangeEnd = nextGrid[nextGrid.length - 1].date;
  const [allWorkouts, allBlocks] = await Promise.all([
    getWorkoutsForAthlete(athleteId, rangeStart, rangeEnd),
    getAvailabilityBlocksForRange(athleteId, rangeStart, rangeEnd),
  ]);

  const prevHref = `/athlete/programmation?view=month&month=${monthParamStr(prevYear, prevMonthNum)}`;
  const nextHref = `/athlete/programmation?view=month&month=${monthParamStr(nextYear, nextMonthNum)}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href={prevHref} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ‹
        </Link>
        <p className="text-sm font-semibold capitalize text-ink-soft">{monthLabel(year, month)}</p>
        <Link href={nextHref} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
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

      <SnapScrollNav
        axis="y"
        paneSize={MONTH_PANE_HEIGHT}
        panesKey={monthParamStr(year, month)}
        prevHref={prevHref}
        nextHref={nextHref}
        panes={[
          <div key="prev" style={{ height: MONTH_PANE_HEIGHT }}>
            <MonthGridBody grid={prevGrid} workouts={allWorkouts} blocks={allBlocks} today={today} />
          </div>,
          <div key="cur" style={{ height: MONTH_PANE_HEIGHT }}>
            <MonthGridBody grid={grid} workouts={allWorkouts} blocks={allBlocks} today={today} />
          </div>,
          <div key="next" style={{ height: MONTH_PANE_HEIGHT }}>
            <MonthGridBody grid={nextGrid} workouts={allWorkouts} blocks={allBlocks} today={today} />
          </div>,
        ]}
      />

      <div className="mt-6 flex items-center gap-4 border-t border-line pt-4 text-[11px] text-slate">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-moss" /> Séance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-sm bg-gold-light" /> Objectif / échéance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-sm bg-ink" /> Indisponibilité
        </span>
      </div>
    </div>
  );
}
