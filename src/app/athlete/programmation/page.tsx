import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutsForAthlete, getImportedActivitiesForRange } from "@/lib/queries";
import { getWeekDates, getMonthGrid, monthLabel, todayISO } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { sportLabel } from "@/components/ui";
import { DayLink } from "@/components/day-link";
import { MonthScrollNav } from "./month-scroll-nav";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

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
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-3xl text-ink">Calendrier</h1>
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
  const [workouts, imports] = await Promise.all([
    getWorkoutsForAthlete(athleteId, weekDates[0], weekDates[6]),
    getImportedActivitiesForRange(athleteId, weekDates[0], weekDates[6]),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/athlete/programmation?view=week&week=${offset - 1}`} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ‹
        </Link>
        <p className="text-sm font-semibold text-ink-soft">
          Semaine du {weekDates[0].slice(8, 10)} au {weekDates[6].slice(8, 10)}{" "}
          {new Date(`${weekDates[6]}T00:00:00`).toLocaleDateString("fr-FR", { month: "long" })}
        </p>
        <Link href={`/athlete/programmation?view=week&week=${offset + 1}`} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ›
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {weekDates.map((date, idx) => {
          const dayWorkouts = workouts.filter((w) => w.date === date).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
          const dayImports = imports.filter((a) => a.activity_date === date);
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

              {dayWorkouts.length === 0 && dayImports.length === 0 ? (
                <p className="pl-9 text-xs text-slate">Repos</p>
              ) : (
                <div className="flex flex-col gap-1.5 pl-9">
                  {dayWorkouts.map((w) => (
                    <Link key={w.id} href={`/workouts/${w.id}`} className="flex items-center gap-2 text-sm hover:underline">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
                      <span className="text-ink">{w.title}</span>
                      <span className="text-xs text-slate">
                        {w.time ? `${w.time} · ` : ""}
                        {sportLabel(w.sport)}
                      </span>
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

  const grid = getMonthGrid(year, month);
  const workouts = await getWorkoutsForAthlete(athleteId, grid[0].date, grid[grid.length - 1].date);

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
        <Link href={`/athlete/programmation?view=month&month=${prevMonth()}`} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ‹
        </Link>
        <p className="text-sm font-semibold capitalize text-ink-soft">{monthLabel(year, month)}</p>
        <Link href={`/athlete/programmation?view=month&month=${nextMonth()}`} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
          ›
        </Link>
      </div>
      <p className="mb-3 text-center text-[10.5px] text-slate">⌃ défiler pour changer de mois ⌄</p>

      <MonthScrollNav
        prevHref={`/athlete/programmation?view=month&month=${prevMonth()}`}
        nextHref={`/athlete/programmation?view=month&month=${nextMonth()}`}
      >
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
            const hasTraining = dayWorkouts.some((w) => w.category !== "objectif" && w.category !== "evenement");
            const isToday = cell.date === today;

            return (
              <DayLink key={cell.date} href={`/athlete/day/${cell.date}`} className="flex flex-col items-center gap-1 py-1">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold ${
                    isToday ? "bg-gold-light text-white" : cell.inMonth ? "text-ink hover:bg-paper-dim" : "text-line"
                  }`}
                >
                  {cell.day}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {hasTraining && <span className="h-1.5 w-1.5 rounded-full bg-moss" />}
                  {hasGoal && <span className="h-1.5 w-1.5 rounded-sm bg-gold-light" />}
                </span>
              </DayLink>
            );
          })}
        </div>
      </MonthScrollNav>

      <div className="mt-6 flex items-center gap-4 border-t border-line pt-4 text-[11px] text-slate">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-moss" /> Séance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-sm bg-gold-light" /> Objectif / échéance
        </span>
      </div>
    </div>
  );
}
