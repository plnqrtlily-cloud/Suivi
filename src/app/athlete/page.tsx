import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getWorkoutsForAthlete,
  getCoachesForAthlete,
  profileCompletion,
  getCheckinForDate,
  getImportedActivitiesForRange,
  getUserGender,
} from "@/lib/queries";
import { estimateCyclePhase } from "@/lib/cycle";
import { Nav } from "@/components/nav";
import { Card, sportLabel, LinkButton } from "@/components/ui";
import { JoinCoachForm } from "./join-coach-form";
import { RevokeButton } from "@/app/coach/revoke-button";
import { DailyCheckin } from "./daily-checkin";
import { ReadinessSummary } from "./readiness-summary";
import { CheckinModal } from "./checkin-modal";
import { SessionCard } from "./session-card";
import { CycleBadge } from "./cycle-badge";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getWeekDates(offsetWeeks: number): string[] {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
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
  const today = new Date().toISOString().slice(0, 10);
  const selectedDate = day && DATE_RE.test(day) && weekDates.includes(day) ? day : weekDates.includes(today) ? today : weekDates[0];
  const isToday = selectedDate === today;

  const coaches = await getCoachesForAthlete(user.id);
  const completion = await profileCompletion(user.id);
  const todaysCheckin = await getCheckinForDate(user.id, today);
  const selectedCheckin = isToday ? todaysCheckin : await getCheckinForDate(user.id, selectedDate);

  const selectedWorkouts = await getWorkoutsForAthlete(user.id, selectedDate, selectedDate);
  const selectedImports = await getImportedActivitiesForRange(user.id, selectedDate, selectedDate);
  const primaryWorkout = [...selectedWorkouts].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))[0];
  const otherCount = selectedWorkouts.length + selectedImports.length - (primaryWorkout ? 1 : 0);

  const gender = await getUserGender(user.id);
  const cycleEstimate = gender === "female" ? await estimateCyclePhase(user.id) : null;

  function weekLink(o: number) {
    return `/athlete?week=${o}`;
  }
  function dayLink(o: number, date: string) {
    return `/athlete?week=${o}&day=${date}`;
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
          <h1 className="font-display text-3xl text-ink">Mon calendrier</h1>
          {(offset !== 0 || selectedDate !== today) && (
            <Link href="/athlete" className="text-sm font-semibold text-moss-dark hover:underline">
              Revenir à aujourd&apos;hui
            </Link>
          )}
        </div>

        {completion < 100 && (
          <Card className="mb-6 flex items-center justify-between bg-paper-dim">
            <p className="text-sm text-ink-soft">Profil complété à {completion}%</p>
            <LinkButton href="/athlete/profile" variant="secondary">
              Compléter mon profil
            </LinkButton>
          </Card>
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

          <div className="flex gap-1 py-2">
            {weekDates.map((date, idx) => {
              const isSel = date === selectedDate;
              const isCurDay = date === today;
              return (
                <Link key={date} href={dayLink(offset, date)} className="flex-1 rounded-2xl py-2 text-center">
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

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-4">
            <Link href={`/athlete/day/${selectedDate}`} className="text-lg font-bold capitalize text-ink hover:underline">
              {formattedSelectedDate}
            </Link>
            <div className="flex items-center gap-2">
              {cycleEstimate && <CycleBadge estimate={cycleEstimate} />}
              {isToday && (
                <span className="rounded-full bg-gold-light/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gold-light">
                  Aujourd&apos;hui
                </span>
              )}
            </div>
          </div>

          <p className="mb-1 mt-5 text-[11px] font-bold uppercase tracking-wider text-slate">Résumé du jour</p>
          {selectedCheckin ? (
            <ReadinessSummary date={selectedDate} checkin={selectedCheckin} />
          ) : (
            <Card>
              <p className="mb-3 text-sm text-slate">Aucune forme enregistrée pour ce jour.</p>
              <DailyCheckin date={selectedDate} existing={selectedCheckin} />
            </Card>
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

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-medium text-ink-soft">Mes coachs</h2>
            {coaches.length === 0 && <p className="text-sm text-slate">Aucun coach lié pour l&apos;instant.</p>}
            <ul className="mb-4 space-y-2 text-sm">
              {coaches.map((c) => (
                <li key={c.link_id} className="flex items-center justify-between">
                  <span className="text-ink">
                    {c.first_name} {c.last_name} — {c.email}
                  </span>
                  <span className="flex items-center gap-2">
                    <Link href={`/athlete/messages/${c.coach_id}`} className="text-xs text-moss-dark underline">
                      💬 Discuter
                    </Link>
                    <RevokeButton linkId={c.link_id} label="Retirer l'accès" />
                  </span>
                </li>
              ))}
            </ul>
            <JoinCoachForm />
          </Card>
        </div>
      </main>
    </div>
  );
}
