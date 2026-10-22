import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getWorkoutsForAthlete,
  getImportedActivitiesForRange,
  getAvailabilityBlocksForRange,
  getTrainingPeriodsForRange,
  type AvailabilityBlock,
  type ImportedActivity,
  type Workout,
} from "@/lib/queries";
import { getWeekDates, getMonthGrid, monthLabel, todayISO, toISODate } from "@/lib/dates";
import { AVAILABILITY_SLOT_LABELS, resolveTimeForSort, formatWorkoutTime } from "@/lib/time-of-day";
import { Nav } from "@/components/nav";
import { sportLabel } from "@/components/ui";
import { DeleteAvailabilityButton } from "@/components/delete-availability-button";
import { EditAvailabilityModal } from "@/components/availability-modal";
import { EditImportedActivityModal, DeleteImportedActivityButton } from "@/components/imported-activity-modal";
import { CalendarAddButton } from "./calendar-add-button";
import { Chip, SportIcon, durationLabel, isGoal, statusKey } from "../athlete-ui";

const DAY_SHORT = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const DONE_COLOR = "#8a5a44";
const PET = "#1b4b4f";

function frRange(a: string, b: string) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  const m = (d: Date) => d.toLocaleDateString("fr-FR", { month: "long" });
  return da.getMonth() === db.getMonth() ? `${da.getDate()} – ${db.getDate()} ${m(db)}` : `${da.getDate()} ${m(da)} – ${db.getDate()} ${m(db)}`;
}

function sortByTime<T>(items: T[], time: (t: T) => string | null) {
  return [...items].sort((x, y) => resolveTimeForSort(time(x)).localeCompare(resolveTimeForSort(time(y))));
}

// Une ligne de calendrier : icône du sport, titre, moment · durée · qui l'a
// ajoutée, statut à droite ; crayon et croix sur ce que l'athlète a ajouté.
function CalItem({
  icon,
  iconColor,
  title,
  sub,
  chip,
  href,
  actions,
  muted = false,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  sub: string;
  chip?: React.ReactNode;
  href?: string;
  actions?: React.ReactNode;
  muted?: boolean;
}) {
  const inner = (
    <>
      <span className="flex flex-shrink-0" style={{ color: iconColor }}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-[14.5px] font-semibold text-ink">{title}</b>
        <span className="truncate text-xs text-slate">{sub}</span>
      </span>
    </>
  );
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${muted ? "bg-[#f2f4f3]" : "bg-white"}`}>
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2.5">
          {inner}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5">{inner}</div>
      )}
      {chip}
      {actions}
    </div>
  );
}

function DayItems({
  date,
  today,
  workouts,
  imports,
  blocks,
  muted = false,
}: {
  date: string;
  today: string;
  workouts: Workout[];
  imports: ImportedActivity[];
  blocks: AvailabilityBlock[];
  muted?: boolean;
}) {
  const ws = sortByTime(
    workouts.filter((w) => w.date === date),
    (w) => w.time
  );
  const ims = sortByTime(
    imports.filter((a) => a.activity_date === date),
    (a) => a.activity_time
  );
  const bs = blocks.filter((b) => b.date === date);
  return (
    <>
      {bs.map((b) => (
        <div key={b.id} className="flex items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-[13px] text-white">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
            <path d="M7 9V6.5a3 3 0 016 0V9" />
          </svg>
          <span className="min-w-0 flex-1 truncate">
            <b className="font-semibold">Indisponible · {AVAILABILITY_SLOT_LABELS[b.time_of_day].toLowerCase()}</b>
            {b.reason && <span className="text-white/70"> — {b.reason}</span>}
            <span className="text-white/50"> · {b.created_by ? "par ton coach" : "par toi"}</span>
          </span>
          <span className="flex flex-shrink-0 items-center gap-3.5">
            <EditAvailabilityModal block={b} className="text-white/60 hover:text-white" />
            <DeleteAvailabilityButton id={b.id} className="text-white/60 hover:text-white" />
          </span>
        </div>
      ))}
      {ws.map((w) =>
        isGoal(w) ? (
          <CalItem
            key={w.id}
            muted={muted}
            icon={<SportIcon sport={w.sport} size={18} />}
            iconColor="#c9a227"
            title={w.title}
            sub={w.category === "evenement" ? "Événement" : "Objectif"}
            href={`/workouts/${w.id}`}
            chip={
              <span className="whitespace-nowrap rounded-full bg-[#fbf3dc] px-2.5 py-0.5 text-xs font-semibold text-[#8a6d12]">
                Objectif{w.priority ? ` ${w.priority}` : ""}
              </span>
            }
          />
        ) : (
          <CalItem
            key={w.id}
            muted={muted}
            icon={<SportIcon sport={w.sport} size={18} />}
            iconColor={w.color || PET}
            title={w.title}
            sub={[formatWorkoutTime(w.time), durationLabel(w.duration_minutes), `par ${w.coach_first_name ?? "ton coach"}`].filter(Boolean).join(" · ")}
            href={`/workouts/${w.id}`}
            chip={<Chip k={statusKey(w, today)} />}
          />
        )
      )}
      {ims.map((a) => (
        <CalItem
          key={a.id}
          muted={muted}
          icon={<SportIcon sport={a.sport} size={18} />}
          iconColor={DONE_COLOR}
          title={sportLabel(a.sport)}
          sub={[a.activity_time, durationLabel(a.duration_minutes), a.distance_km ? `${String(a.distance_km).replace(".", ",")} km` : null, a.created_by ? "par ton coach" : "par toi"]
            .filter(Boolean)
            .join(" · ")}
          href={`/athlete/day/${date}`}
          chip={<Chip k="done" />}
          actions={
            <span className="flex flex-shrink-0 items-center gap-3.5 pl-1 text-slate">
              <EditImportedActivityModal activity={a} className="hover:text-ink" />
              <DeleteImportedActivityButton id={a.id} className="hover:text-clay" />
            </span>
          }
        />
      ))}
    </>
  );
}

function dayMinutes(date: string, workouts: Workout[], imports: ImportedActivity[]) {
  const w = workouts.filter((x) => x.date === date && !isGoal(x)).reduce((s, x) => s + (x.duration_minutes || 0), 0);
  const i = imports.filter((x) => x.activity_date === date).reduce((s, x) => s + (x.duration_minutes || 0), 0);
  return w + i;
}

export default async function ProgrammationPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; month?: string; day?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");

  const { view, week, month, day } = await searchParams;
  const activeView = view === "month" ? "month" : "week";
  const today = todayISO();

  return (
    <div className="min-h-screen bg-[#f2f4f3]">
      <Nav user={user} />
      <main className="mx-auto flex max-w-xl flex-col pb-28 lg:pb-10">
        <header className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-6">
          <h1 className="text-[30px] font-bold leading-tight tracking-tight text-ink">Calendrier</h1>
          <CalendarAddButton defaultDate={today} />
        </header>
        <div className="px-4 pb-3">
          <div className="flex gap-1 rounded-xl bg-[#e3e8e6] p-[3px]">
            {[
              ["week", "Semaine"],
              ["month", "Mois"],
            ].map(([v, l]) => (
              <Link
                key={v}
                href={`/athlete/programmation?view=${v}`}
                className={`flex-1 rounded-[10px] py-2 text-center text-sm font-bold ${activeView === v ? "bg-white text-ink shadow-sm" : "text-slate"}`}
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
        {activeView === "week" ? (
          <WeekView athleteId={user.id} offset={Number.isFinite(Number(week)) ? Number(week || 0) : 0} today={today} />
        ) : (
          <MonthView athleteId={user.id} monthParam={month} dayParam={day} today={today} />
        )}
      </main>
    </div>
  );
}

// Deux semaines d'affilée (celle demandée et la suivante), chaque jour sur
// une ligne ; les liens en haut et en bas avancent d'une semaine.
async function WeekView({ athleteId, offset, today }: { athleteId: string; offset: number; today: string }) {
  const weeks = [getWeekDates(offset), getWeekDates(offset + 1)];
  const from = weeks[0][0];
  const to = weeks[1][6];
  const [workouts, imports, blocks, periods] = await Promise.all([
    getWorkoutsForAthlete(athleteId, from, to),
    getImportedActivitiesForRange(athleteId, from, to),
    getAvailabilityBlocksForRange(athleteId, from, to),
    getTrainingPeriodsForRange(athleteId, from, to),
  ]);

  const link = (o: number) => `/athlete/programmation?view=week&week=${o}`;
  return (
    <div className="flex flex-col gap-2 px-4">
      <Link href={link(offset - 1)} scroll={false} className="self-center py-1 text-[13px] font-semibold text-moss-dark">
        ↑ Semaine précédente
      </Link>
      {weeks.map((dates) => {
        const planned = workouts.filter((w) => dates.includes(w.date) && !isGoal(w)).reduce((s, w) => s + (w.duration_minutes || 0), 0);
        const done =
          workouts
            .filter((w) => dates.includes(w.date) && !isGoal(w) && (w.status === "done" || w.status === "partial"))
            .reduce((s, w) => s + (w.actual_duration_minutes || w.duration_minutes || 0), 0) +
          imports.filter((a) => dates.includes(a.activity_date)).reduce((s, a) => s + (a.duration_minutes || 0), 0);
        const mid = dates[3];
        const period =
          periods.find((p) => p.level === "cycle" && p.start_date <= mid && p.end_date >= mid) ??
          periods.find((p) => p.level === "bloc" && p.start_date <= mid && p.end_date >= mid);
        const summary = [period?.name, planned || done ? `${durationLabel(done) ?? "0 min"} faites sur ${durationLabel(planned) ?? "0 min"}` : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <section key={dates[0]} className="flex flex-col gap-2.5 pb-3">
            <div className="flex flex-wrap items-baseline gap-x-2 px-1 pt-2">
              <b className="text-[15px] text-ink">{frRange(dates[0], dates[6])}</b>
              {summary && <span className="text-[12.5px] text-slate">{summary}</span>}
            </div>
            {dates.map((date, idx) => {
              const isToday = date === today;
              const total = dayMinutes(date, workouts, imports);
              const has =
                workouts.some((w) => w.date === date) || imports.some((a) => a.activity_date === date) || blocks.some((b) => b.date === date);
              return (
                <div key={date} className={`flex gap-3 ${date < today ? "opacity-80" : ""}`}>
                  <Link href={`/athlete/day/${date}`} className="flex w-10 flex-shrink-0 flex-col items-center gap-0.5 pt-1">
                    <span className="text-[11px] font-bold uppercase text-slate">{DAY_SHORT[idx]}</span>
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold ${isToday ? "bg-[#1b4b4f] text-white" : "text-ink"}`}
                    >
                      {Number(date.slice(8, 10))}
                    </span>
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 border-b border-paper-dim pb-3">
                    <div className="flex min-h-1 justify-end">{total > 0 && <span className="text-xs font-semibold text-slate">{durationLabel(total)}</span>}</div>
                    {has ? (
                      <DayItems date={date} today={today} workouts={workouts} imports={imports} blocks={blocks} />
                    ) : (
                      <span className="py-1.5 text-[13px] text-slate">Repos</span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
      <Link href={link(offset + 1)} scroll={false} className="self-center py-2 text-[13px] font-semibold text-moss-dark">
        Semaine suivante ↓
      </Link>
    </div>
  );
}

const DOT = { planned: PET, done: "#8a5a44", missed: "#e8896a", goal: "#c9a227", block: "#182220" };

async function MonthView({ athleteId, monthParam, dayParam, today }: { athleteId: string; monthParam?: string; dayParam?: string; today: string }) {
  const now = new Date(`${today}T00:00:00`);
  const [year, month] = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const grid = getMonthGrid(year, month);
  while (grid.length < 42) {
    const last = new Date(`${grid[grid.length - 1].date}T00:00:00`);
    last.setDate(last.getDate() + 1);
    grid.push({ date: toISODate(last), day: last.getDate(), inMonth: false });
  }
  const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);
  const inMonthDates = grid.filter((c) => c.inMonth).map((c) => c.date);
  const selected =
    dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) && inMonthDates.includes(dayParam) ? dayParam : inMonthDates.includes(today) ? today : inMonthDates[0];

  const from = grid[0].date;
  const to = grid[grid.length - 1].date;
  const [workouts, imports, blocks] = await Promise.all([
    getWorkoutsForAthlete(athleteId, from, to),
    getImportedActivitiesForRange(athleteId, from, to),
    getAvailabilityBlocksForRange(athleteId, from, to),
  ]);

  const dots = (date: string) => {
    const out: string[] = [];
    for (const w of workouts.filter((x) => x.date === date)) {
      if (isGoal(w)) out.push(DOT.goal);
      else out.push(statusKey(w, today) === "not_done" || statusKey(w, today) === "noreturn" ? DOT.missed : DOT.planned);
    }
    for (let i = 0; i < imports.filter((a) => a.activity_date === date).length; i++) out.push(DOT.done);
    if (blocks.some((b) => b.date === date)) out.push(DOT.block);
    return out.slice(0, 4);
  };
  const base = `/athlete/programmation?view=month&month=${monthKey(year, month)}`;
  const selDate = new Date(`${selected}T00:00:00`);
  const selTotal = dayMinutes(selected, workouts, imports);
  const selHas = workouts.some((w) => w.date === selected) || imports.some((a) => a.activity_date === selected) || blocks.some((b) => b.date === selected);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2.5 px-4">
        <div className="flex items-center justify-between px-1">
          <Link href={`/athlete/programmation?view=month&month=${monthKey(prev.getFullYear(), prev.getMonth() + 1)}`} scroll={false} aria-label="Mois précédent" className="flex h-9 w-9 items-center justify-center rounded-full text-slate hover:bg-white">
            ‹
          </Link>
          <b className="text-base capitalize text-ink">{monthLabel(year, month)}</b>
          <Link href={`/athlete/programmation?view=month&month=${monthKey(next.getFullYear(), next.getMonth() + 1)}`} scroll={false} aria-label="Mois suivant" className="flex h-9 w-9 items-center justify-center rounded-full text-slate hover:bg-white">
            ›
          </Link>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate">
          {"LMMJVSD".split("").map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {grid.map((c) => {
            const sel = c.date === selected;
            const ds = c.inMonth ? dots(c.date) : [];
            return (
              <Link
                key={c.date}
                href={c.inMonth ? `${base}&day=${c.date}` : `/athlete/programmation?view=month&month=${c.date.slice(0, 7)}&day=${c.date}`}
                scroll={false}
                className="flex flex-col items-center gap-[3px] py-1"
              >
                <span
                  className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[15px] ${
                    sel ? "bg-[#1b4b4f] font-bold text-white" : c.date === today ? "font-bold text-[#1b4b4f] ring-2 ring-[#1b4b4f]/30" : c.inMonth ? "font-bold text-ink" : "text-line"
                  }`}
                >
                  {c.day}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {ds.map((col, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: col }} />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 pb-2 text-[11.5px] text-slate">
          {[
            [DOT.planned, "Séance prévue"],
            [DOT.done, "Ajoutée par toi"],
            [DOT.missed, "Pas faite"],
            [DOT.goal, "Objectif"],
            [DOT.block, "Indispo"],
          ].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
      </div>
      <section className="mt-1 flex flex-col gap-2 rounded-t-[18px] bg-white px-4 pb-6 pt-3.5">
        <div className="flex items-baseline">
          <Link href={`/athlete/day/${selected}`} className="text-base font-bold capitalize text-ink">
            {selDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </Link>
          <span className="flex-1" />
          {selTotal > 0 && <span className="text-[12.5px] text-slate">{durationLabel(selTotal)}</span>}
        </div>
        {selHas ? (
          <DayItems date={selected} today={today} workouts={workouts} imports={imports} blocks={blocks} muted />
        ) : (
          <p className="py-2 text-sm text-slate">Rien de prévu ce jour-là.</p>
        )}
      </section>
    </div>
  );
}
