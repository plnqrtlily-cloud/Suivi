import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getWorkoutsForAthlete,
  getTrainingPeriods,
  getCheckinForDate,
  getImportedActivitiesForRange,
  getUserGender,
  getJournalForAthlete,
  getNextGoalForAthlete,
  getAvailabilityBlocksForRange,
  type Workout,
  type ImportedActivity,
  type AvailabilityBlock,
} from "@/lib/queries";
import { getOngoingHealthReports, getUnreadHealthCounts, getPainHistory, HEALTH_CATEGORY_LABEL, TRAINING_IMPACT_LABEL } from "@/lib/health";
import { AVAILABILITY_SLOT_LABELS, resolveTimeForSort, formatWorkoutTime } from "@/lib/time-of-day";
import { EditImportedActivityModal, DeleteImportedActivityButton } from "@/components/imported-activity-modal";
import { EditAvailabilityModal } from "@/components/availability-modal";
import { DeleteAvailabilityButton } from "@/components/delete-availability-button";
import { estimateCyclePhase } from "@/lib/cycle";
import { getWeekDates, todayISO, daysUntil } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { sportLabel } from "@/components/ui";
import { SnapScrollNav } from "@/components/snap-scroll-nav";
import { JournalEntry } from "./journal-entry";
import { CheckinModal } from "./checkin-modal";
import { CycleBadge } from "./cycle-badge";
import { FormeRow } from "./forme-row";
import { SeasonFrise, type FriseSegment } from "./season-frise";
import { Chip, ItemCard, SportIcon, durationLabel, isGoal, statusKey, STATUS_CHIP } from "./athlete-ui";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
const PET = "#1b4b4f";

type DayMark = "done" | "missed" | "planned" | "goal" | null;

function dayMark(date: string, today: string, workouts: Workout[], imports: ImportedActivity[]): DayMark {
  const ws = workouts.filter((w) => w.date === date);
  if (ws.some(isGoal)) return "goal";
  const training = ws.filter((w) => !isGoal(w));
  const doneImport = imports.some((a) => a.activity_date === date);
  if (date < today) {
    if (training.some((w) => w.status === "not_done" || w.status === "planned")) return "missed";
    if (training.length || doneImport) return "done";
    return null;
  }
  if (training.every((w) => w.status === "done") && (training.length || doneImport)) return date === today ? "done" : "planned";
  return training.length ? "planned" : null;
}

function WeekRow({
  dates,
  weekOffset,
  today,
  selectedDate,
  workouts,
  imports,
}: {
  dates: string[];
  weekOffset: number;
  today: string;
  selectedDate: string;
  workouts: Workout[];
  imports: ImportedActivity[];
}) {
  return (
    <div className="flex justify-between py-1">
      {dates.map((date, idx) => {
        const isSel = date === selectedDate;
        const mark = dayMark(date, today, workouts, imports);
        return (
          <Link
            key={date}
            href={`/athlete?week=${weekOffset}&day=${date}`}
            scroll={false}
            aria-current={isSel ? "date" : undefined}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <span className="text-[11px] font-semibold text-slate">{DAY_LETTERS[idx]}</span>
            <span
              className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[15px] font-bold ${
                isSel ? "bg-[#1b4b4f] text-white" : date === today ? "text-[#1b4b4f] ring-2 ring-[#1b4b4f]/30" : "text-ink"
              }`}
            >
              {Number(date.slice(8, 10))}
            </span>
            <span className="flex h-[11px] items-center">
              {mark === "done" ? (
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke={PET} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="fait">
                  <path d="M4.5 10.5l3.5 3.5 7.5-8" />
                </svg>
              ) : mark ? (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: mark === "missed" ? "#e8896a" : mark === "goal" ? "#c9a227" : "#9fc3c4" }}
                />
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function SessionHero({ w, today }: { w: Workout; today: string }) {
  const k = statusKey(w, today);
  const moment = formatWorkoutTime(w.time);
  const pills = [durationLabel(w.duration_minutes), w.planned_rpe ? `RPE ${w.planned_rpe}` : null, isGoal(w) ? (w.priority ? `Objectif ${w.priority}` : "Objectif") : sportLabel(w.sport)].filter(
    Boolean
  ) as string[];
  const consigne = (w.description || "").trim().split("\n").find((l) => l.trim()) || "";
  const done = k === "done";
  return (
    <article className="flex flex-col gap-3 rounded-[22px] bg-[#1b4b4f] p-4 text-white">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
          <SportIcon sport={w.sport} size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#9fc3c4]">
            Ta séance{moment ? ` · ${moment.toLowerCase()}` : ""}
            {k !== "todo" ? ` · ${STATUS_CHIP[k].label.toLowerCase()}` : ""}
          </span>
          <b className="text-lg leading-tight">{w.title}</b>
        </div>
      </div>
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pills.map((p) => (
            <span key={p} className="rounded-full bg-white/15 px-2.5 py-1 text-[12.5px] font-bold">
              {p}
            </span>
          ))}
        </div>
      )}
      {consigne && (
        <div className="flex items-start gap-2.5">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-[#1b4b4f]">
            {(w.coach_first_name || "C").slice(0, 1)}
          </span>
          <p className="line-clamp-3 text-sm leading-relaxed text-[#e3ecea]">{consigne}</p>
        </div>
      )}
      <div className="flex gap-2 border-t border-white/15 pt-3">
        {!isGoal(w) && (
          <Link
            href={`/workouts/${w.id}#renseigner`}
            className="flex-1 rounded-xl bg-white py-3 text-center text-[15px] font-bold text-[#1b4b4f]"
          >
            {done ? "Mon retour" : "Renseigner"}
          </Link>
        )}
        <Link href={`/workouts/${w.id}`} className="flex-1 rounded-xl bg-white/15 py-3 text-center text-[15px] font-bold text-white">
          Voir la séance
        </Link>
      </div>
    </article>
  );
}

function shortFr(iso: string, today: string) {
  if (iso === today) return "aujourd'hui";
  const d = new Date(`${iso}T00:00:00`);
  const diff = daysUntil(iso);
  if (diff === -1) return "hier";
  if (diff > -7 && diff < 0) return d.toLocaleDateString("fr-FR", { weekday: "long" });
  return `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

function buildFrise(periods: Awaited<ReturnType<typeof getTrainingPeriods>>, today: string): FriseSegment[] {
  const season = periods.find((p) => p.level === "saison" && p.start_date <= today && p.end_date >= today);
  let blocs = periods.filter((p) => p.level === "bloc");
  if (season) blocs = blocs.filter((b) => b.parent_id === season.id || (b.start_date >= season.start_date && b.end_date <= season.end_date));
  else {
    const cur = blocs.find((b) => b.start_date <= today && b.end_date >= today);
    if (!cur) return [];
    // Sans saison, on montre le bloc en cours avec ses voisins immédiats.
    const i = blocs.indexOf(cur);
    blocs = blocs.slice(Math.max(0, i - 2), i + 2);
  }
  const days = (a: string, b: string) => Math.max(1, Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000) + 1);
  return blocs
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((b) => {
      const current = b.start_date <= today && b.end_date >= today;
      return {
        id: b.id,
        name: b.name,
        weight: days(b.start_date, b.end_date),
        state: current ? "current" : b.end_date < today ? "past" : "future",
        progress: current ? Math.min(1, (days(b.start_date, today) - 0.5) / days(b.start_date, b.end_date)) : 0,
      } as FriseSegment;
    });
}

export default async function AthleteDashboard({ searchParams }: { searchParams: Promise<{ week?: string; day?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");

  const { week, day } = await searchParams;
  const offset = Number.isFinite(Number(week)) ? Number(week || 0) : 0;
  const weekDates = getWeekDates(offset);
  const today = todayISO();
  const selectedDate = day && DATE_RE.test(day) && weekDates.includes(day) ? day : weekDates.includes(today) ? today : weekDates[0];
  const isToday = selectedDate === today;
  const prevDates = getWeekDates(offset - 1);
  const nextDates = getWeekDates(offset + 1);

  const [journal, todaysCheckin, otherDayCheckin, rangeWorkouts, rangeImports, gender, nextGoal, periods, selectedBlocks, ongoing] = await Promise.all([
    getJournalForAthlete(user.id, selectedDate),
    getCheckinForDate(user.id, today),
    isToday ? Promise.resolve(undefined) : getCheckinForDate(user.id, selectedDate),
    getWorkoutsForAthlete(user.id, prevDates[0], nextDates[6]),
    getImportedActivitiesForRange(user.id, prevDates[0], nextDates[6]),
    getUserGender(user.id),
    getNextGoalForAthlete(user.id, today),
    getTrainingPeriods(user.id),
    getAvailabilityBlocksForRange(user.id, selectedDate, selectedDate),
    getOngoingHealthReports(user.id, today),
  ]);
  const [unreadHealth, pains] = await Promise.all([
    getUnreadHealthCounts(
      ongoing.map((r) => r.id),
      user.id
    ),
    Promise.all(ongoing.map((r) => getPainHistory(r.id))),
  ]);
  const selectedCheckin = isToday ? todaysCheckin : otherDayCheckin;
  const dayWorkouts = rangeWorkouts
    .filter((w) => w.date === selectedDate)
    .sort((a, b) => resolveTimeForSort(a.time).localeCompare(resolveTimeForSort(b.time)));
  const dayImports = rangeImports.filter((a) => a.activity_date === selectedDate);
  // La séance mise en avant : la première séance d'entraînement encore à
  // faire, sinon la première du jour (y compris un objectif).
  const training = dayWorkouts.filter((w) => !isGoal(w));
  const hero = training.find((w) => w.status === "planned") ?? training[0] ?? dayWorkouts[0];
  const others = dayWorkouts.filter((w) => w !== hero);

  const cycleEstimate = gender === "female" ? await estimateCyclePhase(user.id) : null;
  const frise = buildFrise(periods, today);
  const goalDays = nextGoal ? daysUntil(nextGoal.date) : null;

  const selDate = new Date(`${selectedDate}T00:00:00`);
  const dateLine = selDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, (c) => c.toUpperCase());
  const title = isToday ? "Aujourd'hui" : selDate.toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  const weekLink = (o: number) => `/athlete?week=${o}`;
  const nothing = dayWorkouts.length === 0 && dayImports.length === 0 && selectedBlocks.length === 0;

  return (
    <div className="min-h-screen bg-[#f2f4f3]">
      <Nav user={user} />
      <CheckinModal date={today} existing={todaysCheckin} firstName={user.first_name} userId={user.id} />
      <main className="mx-auto flex max-w-xl flex-col pb-28 lg:pb-10">
        <header className="flex flex-col gap-3 px-5 pb-2 pt-6">
          <div className="flex items-end gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] font-semibold text-slate">{isToday ? dateLine : dateLine}</span>
              <h1 className="text-[30px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
            </div>
            {!isToday && (
              <Link href="/athlete" className="mb-1.5 text-sm font-semibold text-moss-dark">
                Revenir à aujourd&apos;hui
              </Link>
            )}
          </div>
          <SeasonFrise segments={frise} goalLabel={goalDays != null ? (goalDays === 0 ? "Jour J" : `J-${goalDays}`) : null} goalTitle={nextGoal?.title ?? null} />
          {cycleEstimate && (
            <div>
              <CycleBadge estimate={cycleEstimate} />
            </div>
          )}
        </header>

        <div className="px-4">
          <SnapScrollNav
            axis="x"
            panesKey={`week-${offset}`}
            prevHref={weekLink(offset - 1)}
            nextHref={weekLink(offset + 1)}
            panes={[
              <WeekRow key="prev" dates={prevDates} weekOffset={offset - 1} today={today} selectedDate={selectedDate} workouts={rangeWorkouts} imports={rangeImports} />,
              <WeekRow key="cur" dates={weekDates} weekOffset={offset} today={today} selectedDate={selectedDate} workouts={rangeWorkouts} imports={rangeImports} />,
              <WeekRow key="next" dates={nextDates} weekOffset={offset + 1} today={today} selectedDate={selectedDate} workouts={rangeWorkouts} imports={rangeImports} />,
            ]}
          />
        </div>

        <div className="flex flex-col gap-3 px-4 pt-3">
          {ongoing.map((r, i) => {
            const p = pains[i];
            const painLine =
              p.length > 1 ? `Douleur ${p[0].pain} → ${p[p.length - 1].pain}` : p.length === 1 ? `Douleur ${p[0].pain}` : null;
            const sub = [painLine, r.training_impact ? TRAINING_IMPACT_LABEL[r.training_impact] : null].filter(Boolean).join(" · ") || "Échanger avec ton coach";
            const unread = unreadHealth[r.id] || 0;
            return (
              <Link key={r.id} href={`/sante/${r.id}`} className="flex flex-col gap-2 rounded-2xl bg-[#fff4ef] px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#fbe3da] px-2.5 py-0.5 text-xs font-semibold text-[#a4492a]">{HEALTH_CATEGORY_LABEL[r.category]} en cours</span>
                  <span className="flex-1" />
                  <span className="text-xs text-slate">depuis {shortFr(r.date_start, today)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-white text-[#a4492a]">
                    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 16.5s-6-3.6-6-8.2A3.3 3.3 0 0110 6.3a3.3 3.3 0 016 2c0 4.6-6 8.2-6 8.2z" />
                    </svg>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-[15px] font-semibold text-ink">{r.zone}</b>
                    <span className="truncate text-[12.5px] text-slate">{sub}</span>
                  </span>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e8896a] px-1.5 text-[11px] font-bold text-white">{unread}</span>
                  )}
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#5b6660" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 5l5 5-5 5" />
                  </svg>
                </div>
              </Link>
            );
          })}

          {(isToday || selectedCheckin) && <FormeRow key={selectedDate} date={selectedDate} checkin={selectedCheckin} />}

          {hero && <SessionHero w={hero} today={today} />}

          {others.map((w) => (
            <ItemCard
              key={w.id}
              chip={isGoal(w) ? <span className="rounded-full bg-[#fbf3dc] px-2.5 py-0.5 text-xs font-semibold text-[#8a6d12]">Objectif{w.priority ? ` ${w.priority}` : ""}</span> : <Chip k={statusKey(w, today)} />}
              by={`par ${w.coach_first_name ?? "ton coach"}`}
              icon={<SportIcon sport={w.sport} size={19} />}
              iconColor={w.color || PET}
              title={w.title}
              sub={[formatWorkoutTime(w.time), durationLabel(w.duration_minutes)].filter(Boolean).join(" · ") || sportLabel(w.sport)}
              href={`/workouts/${w.id}`}
            />
          ))}

          {dayImports.map((a: ImportedActivity) => (
            <ItemCard
              key={a.id}
              chip={<Chip k="done" />}
              by={a.created_by ? "par ton coach" : a.source === "manual" ? "par toi" : a.source === "garmin" ? "Garmin" : "Strava"}
              icon={<SportIcon sport={a.sport} size={19} />}
              iconColor="#8a5a44"
              title={sportLabel(a.sport)}
              sub={
                [a.activity_time, a.duration_minutes ? `${a.duration_minutes} min` : null, a.distance_km ? `${String(a.distance_km).replace(".", ",")} km` : null, a.rpe ? `RPE ${a.rpe}` : null]
                  .filter(Boolean)
                  .join(" · ") || "Séance faite"
              }
              href={`/athlete/day/${selectedDate}`}
              actions={
                <span className="flex flex-shrink-0 items-center gap-3.5 text-slate">
                  <EditImportedActivityModal activity={a} className="hover:text-ink" />
                  <DeleteImportedActivityButton id={a.id} className="hover:text-clay" />
                </span>
              }
            />
          ))}

          {selectedBlocks.map((b: AvailabilityBlock) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
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

          {nothing && (
            <p className="rounded-2xl bg-white px-4 py-4 text-sm text-slate">
              Rien de prévu ce jour-là. Ajoute une séance faite, une indisponibilité ou une note avec le bouton +.
            </p>
          )}

          {journal.length > 0 && (
            <>
              <p className="px-1 pt-2 text-xs font-bold uppercase tracking-[0.06em] text-slate">Journal</p>
              <ul className="flex flex-col gap-2 text-sm">
                {journal.map((j) => (
                  <JournalEntry key={j.id} entry={j} />
                ))}
              </ul>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
