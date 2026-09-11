import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutsForAthlete, getCoachesForAthlete, profileCompletion, getCheckinForDate, getUpcomingGoals } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { Card, StatusBadge, sportLabel, LinkButton } from "@/components/ui";
import { UpcomingGoals } from "@/components/upcoming-goals";
import { JoinCoachForm } from "./join-coach-form";
import { RevokeButton } from "@/app/coach/revoke-button";
import { DailyCheckin } from "./daily-checkin";
import { CalendarFilters } from "./calendar-filters";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

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
  searchParams: Promise<{ week?: string; sport?: string; category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach");

  const { week, sport, category } = await searchParams;
  const offset = week ? Number(week) : 0;
  const weekDates = getWeekDates(offset);

  let workouts = await getWorkoutsForAthlete(user.id, weekDates[0], weekDates[6]);
  if (sport) workouts = workouts.filter((w) => w.sport === sport);
  if (category) workouts = workouts.filter((w) => w.category === category);

  const coaches = await getCoachesForAthlete(user.id);
  const completion = await profileCompletion(user.id);
  const today = new Date().toISOString().slice(0, 10);
  const todaysWorkouts = await getWorkoutsForAthlete(user.id, today, today);
  const todaysCheckin = await getCheckinForDate(user.id, today);
  const upcomingGoals = await getUpcomingGoals(user.id);

  const byDate: Record<string, typeof workouts> = {};
  for (const d of weekDates) byDate[d] = [];
  for (const w of workouts) byDate[w.date]?.push(w);

  function weekLink(o: number) {
    const params = new URLSearchParams();
    params.set("week", String(o));
    if (sport) params.set("sport", sport);
    if (category) params.set("category", category);
    return `/athlete?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink">Mon calendrier</h1>
            <p className="text-slate">
              Semaine du {weekDates[0]} au {weekDates[6]}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={weekLink(offset - 1)} className="rounded-md border border-line px-3 py-2 text-sm hover:border-moss">
              ← Semaine précédente
            </Link>
            <Link href={weekLink(0)} className="rounded-md border border-line px-3 py-2 text-sm hover:border-moss">
              Aujourd&apos;hui
            </Link>
            <Link href={weekLink(offset + 1)} className="rounded-md border border-line px-3 py-2 text-sm hover:border-moss">
              Semaine suivante →
            </Link>
          </div>
        </div>

        {completion < 100 && (
          <Card className="mb-6 flex items-center justify-between bg-paper-dim">
            <p className="text-sm text-ink-soft">Profil complété à {completion}%</p>
            <LinkButton href="/athlete/profile" variant="secondary">
              Compléter mon profil
            </LinkButton>
          </Card>
        )}

        <section className="mb-10 grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-display text-xl text-ink">
              Aujourd&apos;hui —{" "}
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </h2>
            {todaysWorkouts.length === 0 ? (
              <p className="text-sm text-slate">Aucune séance prévue aujourd&apos;hui.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {todaysWorkouts.map((w) => (
                  <Link key={w.id} href={`/workouts/${w.id}`}>
                    <div
                      className="rounded-md border border-line bg-white p-3 text-sm hover:border-moss"
                      style={{ borderLeftColor: w.color, borderLeftWidth: 3 }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-ink">{w.title}</p>
                        <StatusBadge status={w.status} />
                      </div>
                      <p className="text-slate">
                        {sportLabel(w.sport)} {w.time ? `· ${w.time}` : ""}
                        {w.duration_minutes ? ` · ${w.duration_minutes} min` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-xl text-ink">Ma forme du jour</h2>
            <DailyCheckin date={today} existing={todaysCheckin} />
          </Card>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 font-display text-xl text-ink">Prochains objectifs</h2>
          <UpcomingGoals goals={upcomingGoals} />
        </section>

        <CalendarFilters offset={offset} sport={sport} category={category} />

        <h2 className="mb-3 font-display text-xl text-ink">Ma semaine</h2>
        <div className="grid gap-3 md:grid-cols-7">
          {weekDates.map((date, idx) => (
            <div
              key={date}
              className={date === today ? "rounded-md bg-moss/5 p-2 -m-2" : ""}
            >
              <p className={`mb-2 text-xs font-medium uppercase tracking-wide ${date === today ? "text-moss-dark" : "text-slate"}`}>
                {DAY_LABELS[idx]} {date.slice(8, 10)}/{date.slice(5, 7)}
                {date === today && " · aujourd'hui"}
              </p>
              <div className="flex flex-col gap-2">
                {byDate[date].map((w) => (
                  <Link key={w.id} href={`/workouts/${w.id}`}>
                    <div
                      className="rounded-md border border-line bg-white p-2 text-xs hover:border-moss"
                      style={{ borderLeftColor: w.color, borderLeftWidth: 3 }}
                    >
                      <p className="font-medium text-ink">{w.title}</p>
                      <p className="text-slate">{sportLabel(w.sport)}</p>
                      <StatusBadge status={w.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

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
