import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getAthletesForCoach,
  getWorkoutsForAthlete,
  getRecentCheckins,
  getUpcomingGoals,
  getUnreadMessageCount,
} from "@/lib/queries";
import { todayISO, getWeekDates, daysUntil } from "@/lib/dates";
import { computeGlobalScore, scoreLabel } from "@/lib/checkin-types";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Avatar } from "@/components/avatar";
import { Card, sportLabel } from "@/components/ui";
import { sportIconPath } from "@/lib/sport-icons";

// Tableau de bord : ce qui demande l'attention du coach aujourd'hui, tous
// athlètes confondus — plutôt que d'ouvrir chaque fiche une par une pour
// découvrir qu'il n'y a rien de particulier.
export default async function CoachDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const today = todayISO();
  const weekDates = getWeekDates(0);

  const links = await getAthletesForCoach(user.id);
  const activeAthletes = links.filter((l) => l.status === "active" && l.athlete_id);

  const perAthlete = await Promise.all(
    activeAthletes.map(async (l) => {
      const athleteId = l.athlete_id as string;
      const [weekWorkouts, checkins, goals, unread] = await Promise.all([
        getWorkoutsForAthlete(athleteId, weekDates[0], weekDates[6]),
        getRecentCheckins(athleteId, 1),
        getUpcomingGoals(athleteId, 1),
        getUnreadMessageCount(user.id, athleteId, user.id),
      ]);
      const todayWorkouts = weekWorkouts.filter((w) => w.date === today);
      const checkin = checkins[0];
      const score = checkin ? computeGlobalScore(checkin) : null;
      // Un check-in du jour absent n'est pas une alerte en soi (l'athlète ne
      // l'a peut-être pas encore rempli) — on ne signale que ce qui est
      // renseigné ET bas.
      const isLowForm = score !== null && checkin.check_date === today && score < 5;
      return { link: l, athleteId, todayWorkouts, checkin, score, isLowForm, goal: goals[0] as any, unread };
    })
  );

  const alerts = perAthlete.filter((a) => a.isLowForm);
  const withTodaySession = perAthlete.filter((a) => a.todayWorkouts.length > 0);
  const withUnread = perAthlete.filter((a) => a.unread > 0);
  const upcomingGoals = perAthlete
    .filter((a) => a.goal)
    .map((a) => ({ athlete: a.link, goal: a.goal, days: daysUntil(a.goal.date) }))
    .sort((x, y) => x.days - y.days)
    .slice(0, 4);

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/dashboard" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="mb-1 font-display text-3xl text-ink">Tableau de bord</h1>
          <p className="mb-8 text-slate">
            {activeAthletes.length} athlète{activeAthletes.length > 1 ? "s" : ""} suivi
            {activeAthletes.length > 1 ? "s" : ""} ·{" "}
            {new Date(`${today}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>

          {activeAthletes.length === 0 ? (
            <Card className="rounded-3xl">
              <p className="text-slate">
                Aucun athlète actif pour l&apos;instant —{" "}
                <Link href="/coach" className="font-medium text-moss-dark hover:underline">
                  invitez votre premier athlète
                </Link>
                .
              </p>
            </Card>
          ) : (
            <>
              {alerts.length > 0 && (
                <div className="mb-6 flex flex-col gap-2">
                  {alerts.map((a) => (
                    <Link
                      key={a.athleteId}
                      href={`/coach/athletes/${a.athleteId}`}
                      className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-gold-light/40 bg-gold-light/10 px-4 py-3 text-sm hover:border-gold-light"
                    >
                      <span className="text-gold-light">⚠</span>
                      <span className="font-medium text-ink">
                        {a.link.first_name} {a.link.last_name}
                      </span>
                      <span className="text-ink-soft">
                        forme basse aujourd&apos;hui — {a.score}/10 ({scoreLabel(a.score as number)})
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <Card className="rounded-3xl">
                  <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Séances du jour</h2>
                  {withTodaySession.length === 0 ? (
                    <p className="text-sm text-slate">Aucune séance prévue aujourd&apos;hui.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {withTodaySession.map((a) => (
                        <li key={a.athleteId}>
                          <Link
                            href={`/coach/athletes/${a.athleteId}/day/${today}`}
                            className="flex flex-wrap items-center gap-2 text-sm hover:underline"
                          >
                            <Avatar userId={a.athleteId} firstName={a.link.first_name || "?"} hasAvatar={!!a.link.avatar_path} size="sm" />
                            <span className="text-ink">{a.link.first_name}</span>
                            <span className="flex items-center gap-1 text-slate">
                              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke={a.todayWorkouts[0].color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d={sportIconPath(a.todayWorkouts[0].sport)} />
                              </svg>
                              {a.todayWorkouts[0].title}
                              {a.todayWorkouts.length > 1 && ` +${a.todayWorkouts.length - 1}`}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card className="rounded-3xl">
                  <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Messages non lus</h2>
                  {withUnread.length === 0 ? (
                    <p className="text-sm text-slate">Rien à lire pour l&apos;instant.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {withUnread.map((a) => (
                        <li key={a.athleteId}>
                          <Link
                            href={`/coach/athletes/${a.athleteId}/messages`}
                            className="flex items-center gap-2 text-sm hover:underline"
                          >
                            <Avatar userId={a.athleteId} firstName={a.link.first_name || "?"} hasAvatar={!!a.link.avatar_path} size="sm" />
                            <span className="text-ink">
                              {a.link.first_name} {a.link.last_name}
                            </span>
                            <span className="ml-auto rounded-full bg-moss px-2 text-[11px] font-semibold text-white">{a.unread}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              {upcomingGoals.length > 0 && (
                <Card className="mb-6 rounded-3xl">
                  <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Prochaines échéances</h2>
                  <ul className="flex flex-col gap-2">
                    {upcomingGoals.map(({ athlete, goal, days }) => (
                      <li key={goal.id}>
                        <Link href={`/workouts/${goal.id}`} className="flex flex-wrap items-center gap-2 text-sm hover:underline">
                          <Avatar userId={athlete.athlete_id!} firstName={athlete.first_name || "?"} hasAvatar={!!athlete.avatar_path} size="sm" />
                          <span className="text-ink">{athlete.first_name}</span>
                          <span className="text-ink-soft">{goal.title}</span>
                          <span className="ml-auto text-xs font-semibold text-gold-light">
                            {days === 0 ? "aujourd'hui" : `J-${days}`}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="rounded-3xl">
                <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Forme de mes athlètes</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {perAthlete.map((a) => (
                    <Link
                      key={a.athleteId}
                      href={`/coach/athletes/${a.athleteId}`}
                      className="flex items-center gap-2.5 rounded-2xl bg-paper-dim px-3 py-2.5 text-sm hover:bg-line/40"
                    >
                      <Avatar userId={a.athleteId} firstName={a.link.first_name || "?"} hasAvatar={!!a.link.avatar_path} size="sm" />
                      <span className="min-w-0 truncate text-ink">
                        {a.link.first_name} {a.link.last_name}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-slate">
                        {a.score !== null ? `${a.score}/10` : "—"}
                      </span>
                    </Link>
                  ))}
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
