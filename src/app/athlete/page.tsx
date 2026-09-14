import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getWorkoutsForAthlete,
  profileCompletion,
  getCheckinForDate,
  getImportedActivitiesForRange,
  getUserGender,
  getJournalForAthlete,
  getNextGoalForAthlete,
} from "@/lib/queries";
import { addJournalEntryAction } from "@/lib/actions";
import { estimateCyclePhase } from "@/lib/cycle";
import { getWeekDates, todayISO, daysUntil } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { Card, sportLabel, LinkButton, Field, TextAreaField, Button } from "@/components/ui";
import { SnapScrollNav } from "@/components/snap-scroll-nav";
import { JournalEntry } from "./journal-entry";
import { DailyCheckin } from "./daily-checkin";
import { ReadinessSummary } from "./readiness-summary";
import { CheckinModal } from "./checkin-modal";
import { SessionCard } from "./session-card";
import { CycleBadge } from "./cycle-badge";
import { DayLink } from "@/components/day-link";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Un panneau = les 7 pastilles d'une semaine — extrait pour être répété trois
// fois (semaine précédente/courante/suivante) dans le défilement continu.
function WeekPillRow({
  dates,
  weekOffset,
  today,
  selectedDate,
}: {
  dates: string[];
  weekOffset: number;
  today: string;
  selectedDate: string;
}) {
  return (
    <div className="flex gap-1 py-2">
      {dates.map((date, idx) => {
        const isSel = date === selectedDate;
        const isCurDay = date === today;
        return (
          <Link key={date} href={`/athlete?week=${weekOffset}&day=${date}`} className="flex-1 rounded-2xl py-2 text-center">
            <p className="mb-1.5 text-[10px] uppercase text-slate">{DAY_LABELS[idx].slice(0, 1)}</p>
            <div
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-display text-[14px] font-semibold ${
                isSel ? "bg-gold-light text-white" : "text-ink hover:bg-paper-dim"
              }`}
            >
              {date.slice(8, 10)}
            </div>
            <div className={`mx-auto mt-1 h-1 w-1 rounded-full bg-gold-light ${isCurDay && !isSel ? "" : "invisible"}`} />
          </Link>
        );
      })}
    </div>
  );
}

export default async function AthleteDashboard({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; day?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach");

  const { week, day } = await searchParams;
  const offset = week ? Number(week) : 0;
  const weekDates = getWeekDates(offset);
  const today = todayISO();
  const selectedDate = day && DATE_RE.test(day) && weekDates.includes(day) ? day : weekDates.includes(today) ? today : weekDates[0];
  const isToday = selectedDate === today;

  // Toutes ces requêtes sont indépendantes : parties en parallèle plutôt qu'en
  // série pour ne pas payer N×latence réseau vers la base distante (Turso) à
  // chaque chargement de la page.
  const [journal, completion, todaysCheckin, otherDayCheckin, selectedWorkouts, selectedImports, gender, nextGoal] =
    await Promise.all([
      getJournalForAthlete(user.id),
      profileCompletion(user.id),
      getCheckinForDate(user.id, today),
      isToday ? Promise.resolve(undefined) : getCheckinForDate(user.id, selectedDate),
      getWorkoutsForAthlete(user.id, selectedDate, selectedDate),
      getImportedActivitiesForRange(user.id, selectedDate, selectedDate),
      getUserGender(user.id),
      getNextGoalForAthlete(user.id, today),
    ]);
  const selectedCheckin = isToday ? todaysCheckin : otherDayCheckin;
  const primaryWorkout = [...selectedWorkouts].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))[0];
  const otherCount = selectedWorkouts.length + selectedImports.length - (primaryWorkout ? 1 : 0);

  const cycleEstimate = gender === "female" ? await estimateCyclePhase(user.id) : null;

  function weekLink(o: number) {
    return `/athlete?week=${o}`;
  }

  const formattedSelectedDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <CheckinModal date={today} existing={todaysCheckin} firstName={user.first_name} userId={user.id} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl text-ink">Aujourd&apos;hui</h1>
          <div className="flex items-center gap-4">
            {(offset !== 0 || selectedDate !== today) && (
              <Link href="/athlete" className="text-sm font-semibold text-moss-dark hover:underline">
                Revenir à aujourd&apos;hui
              </Link>
            )}
            <Link href="/athlete/programmation" className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
              Calendrier complet
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 5l6 5-6 5" />
              </svg>
            </Link>
          </div>
        </div>

        {completion < 100 && (
          <Card className="mb-6 flex items-center justify-between rounded-3xl bg-paper-dim">
            <p className="text-sm text-ink-soft">Profil complété à {completion}%</p>
            <LinkButton href="/athlete/profile" variant="secondary">
              Compléter mon profil
            </LinkButton>
          </Card>
        )}

        {nextGoal && (
          <Link
            href={`/workouts/${nextGoal.id}`}
            className="mb-6 flex items-center justify-between gap-4 rounded-3xl border border-line bg-white px-5 py-4 transition-colors hover:border-moss"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate">
                {nextGoal.category === "evenement" ? "Prochain événement" : "Prochain objectif"}
              </p>
              <p className="mt-0.5 truncate font-display text-lg font-semibold text-ink">{nextGoal.title}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="font-display text-2xl font-bold leading-none text-gold-light">
                {daysUntil(nextGoal.date) === 0 ? "Jour J" : `J-${daysUntil(nextGoal.date)}`}
              </p>
              <p className="mt-1 text-xs text-slate">
                {new Date(`${nextGoal.date}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              </p>
            </div>
          </Link>
        )}

        <section className="mb-10 rounded-3xl border border-line bg-white p-5">
          <div className="mb-1 flex items-center justify-between">
            <Link href={weekLink(offset - 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
              ‹
            </Link>
            <p className="text-[13px] font-semibold text-ink-soft">
              Semaine du {weekDates[0].slice(8, 10)} au {weekDates[6].slice(8, 10)} {new Date(`${weekDates[6]}T00:00:00`).toLocaleDateString("fr-FR", { month: "long" })}
            </p>
            <Link href={weekLink(offset + 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
              ›
            </Link>
          </div>

          <SnapScrollNav
            axis="x"
            panesKey={`week-${offset}`}
            prevHref={weekLink(offset - 1)}
            nextHref={weekLink(offset + 1)}
            panes={[
              <WeekPillRow key="prev" dates={getWeekDates(offset - 1)} weekOffset={offset - 1} today={today} selectedDate={selectedDate} />,
              <WeekPillRow key="cur" dates={weekDates} weekOffset={offset} today={today} selectedDate={selectedDate} />,
              <WeekPillRow key="next" dates={getWeekDates(offset + 1)} weekOffset={offset + 1} today={today} selectedDate={selectedDate} />,
            ]}
          />

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-4">
            <DayLink href={`/athlete/day/${selectedDate}`} className="text-lg font-bold capitalize text-ink hover:underline">
              {formattedSelectedDate}
            </DayLink>
            <div className="flex items-center gap-2">
              {cycleEstimate && <CycleBadge estimate={cycleEstimate} />}
              {isToday && (
                <span className="rounded-full bg-gold-light/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gold-light">
                  Aujourd&apos;hui
                </span>
              )}
            </div>
          </div>

          {/* Comme sur la page jour : la forme ne se propose que pour aujourd'hui
              ou un jour passé déjà renseigné, jamais à l'avance ni à combler
              rétroactivement. */}
          {(isToday || selectedCheckin) && (
            <>
              <p className="mb-1 mt-5 text-[11px] font-bold uppercase tracking-wider text-slate">Résumé du jour</p>
              {selectedCheckin ? (
                <ReadinessSummary date={selectedDate} checkin={selectedCheckin} />
              ) : (
                <Card>
                  <p className="mb-3 text-sm text-slate">Aucune forme enregistrée pour ce jour.</p>
                  <DailyCheckin date={selectedDate} existing={selectedCheckin} />
                </Card>
              )}
            </>
          )}

          <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wider text-slate">Séance prévue</p>
          {primaryWorkout ? (
            <>
              <SessionCard workout={primaryWorkout} />
              {otherCount > 0 && (
                <Link href={`/athlete/day/${selectedDate}`} className="mt-2 inline-block text-xs font-semibold text-moss-dark hover:underline">
                  + {otherCount} autre{otherCount > 1 ? "s" : ""} ce jour-là — voir le détail
                </Link>
              )}
            </>
          ) : selectedImports.length > 0 ? (
            <Link href={`/athlete/day/${selectedDate}`} className="block rounded-2xl border border-line bg-white p-4 text-sm hover:border-moss">
              <p className="font-medium text-ink">{selectedImports.length} activité{selectedImports.length > 1 ? "s" : ""} importée{selectedImports.length > 1 ? "s" : ""}</p>
              <p className="mt-0.5 text-slate">{selectedImports.map((a) => sportLabel(a.sport)).join(", ")} — voir le détail</p>
            </Link>
          ) : (
            <p className="text-sm text-slate">Aucune séance prévue ni activité enregistrée ce jour-là.</p>
          )}
        </section>

        <div className="mt-10">
          <Card className="rounded-3xl">
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate">Journal de bord</h2>
            <ul className="mb-4 space-y-2 text-sm">
              {journal.map((j) => (
                <JournalEntry key={j.id} entry={j} />
              ))}
              {journal.length === 0 && <p className="text-slate">Aucune entrée pour l&apos;instant.</p>}
            </ul>
            <form action={addJournalEntryAction} className="flex flex-col gap-3">
              <Field label="Date" type="date" name="entryDate" required defaultValue={todayISO()} />
              <TextAreaField label="Note" name="content" rows={3} required placeholder="Sensations du jour, fatigue, contexte particulier…" />
              <div>
                <Button type="submit">Ajouter une entrée</Button>
              </div>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
