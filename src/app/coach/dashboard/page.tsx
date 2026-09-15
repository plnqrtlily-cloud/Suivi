import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getAthletesForCoach,
  getWorkoutsForAthlete,
  getRecentCheckins,
  getUpcomingGoals,
  getUnreadMessageCount,
  getUnvalidatedWorkouts,
  getRecentAthleteComments,
  getNextPlannedWorkoutDate,
  getImportedActivitiesForRange,
} from "@/lib/queries";
import { todayISO, getWeekDates, daysUntil } from "@/lib/dates";
import { computeGlobalScore, scoreLabel } from "@/lib/checkin-types";
import { computeAcwr } from "@/lib/training-stats";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Avatar } from "@/components/avatar";
import { Card, StatusBadge } from "@/components/ui";
import { sportIconPath } from "@/lib/sport-icons";

const FILTERS = [
  { value: "all", label: "Tous" },
  { value: "attention", label: "À surveiller" },
  { value: "today", label: "Séance aujourd'hui" },
];

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Tableau de bord : ce qui demande l'attention du coach aujourd'hui, tous
// athlètes confondus — plutôt que d'ouvrir chaque fiche une par une pour
// découvrir qu'il n'y a rien de particulier.
export default async function CoachDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { filtre } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.value === filtre)?.value ?? "all";

  const today = todayISO();
  const weekDates = getWeekDates(0);
  const acwrFrom = new Date();
  acwrFrom.setDate(acwrFrom.getDate() - 27);
  const unvalidatedSince = new Date();
  unvalidatedSince.setDate(unvalidatedSince.getDate() - 14);

  const links = await getAthletesForCoach(user.id);
  const activeAthletes = links.filter((l) => l.status === "active" && l.athlete_id);

  const [unvalidated, recentComments] = await Promise.all([
    getUnvalidatedWorkouts(user.id, toISO(unvalidatedSince)),
    getRecentAthleteComments(user.id),
  ]);

  const perAthlete = await Promise.all(
    activeAthletes.map(async (l) => {
      const athleteId = l.athlete_id as string;
      const [weekWorkouts, acwrWorkouts, acwrImports, checkins, goals, unread, nextPlanned] = await Promise.all([
        getWorkoutsForAthlete(athleteId, weekDates[0], weekDates[6]),
        getWorkoutsForAthlete(athleteId, toISO(acwrFrom), today),
        getImportedActivitiesForRange(athleteId, toISO(acwrFrom), today),
        getRecentCheckins(athleteId, 1),
        getUpcomingGoals(athleteId, 1),
        getUnreadMessageCount(user.id, athleteId, user.id),
        getNextPlannedWorkoutDate(athleteId),
      ]);
      const todayWorkouts = weekWorkouts.filter((w) => w.date === today);
      const checkin = checkins[0];
      const score = checkin ? computeGlobalScore(checkin) : null;
      // Un check-in du jour absent n'est pas une alerte en soi (l'athlète ne
      // l'a peut-être pas encore rempli) — on ne signale que ce qui est
      // renseigné ET bas.
      const isLowForm = score !== null && checkin.check_date === today && score < 5;
      const acwr = computeAcwr(acwrWorkouts, acwrImports, today);
      // Trou de planification : plus rien de prévu, ou rien avant plus d'une
      // semaine — c'est au coach de programmer la suite.
      const daysToNext = nextPlanned ? daysUntil(nextPlanned) : null;
      const hasPlanningGap = daysToNext === null || daysToNext > 7;
      return {
        link: l,
        athleteId,
        todayWorkouts,
        score,
        isLowForm,
        acwr,
        hasPlanningGap,
        daysToNext,
        goal: goals[0] as any,
        unread,
      };
    })
  );

  const needsAttention = (a: (typeof perAthlete)[number]) =>
    a.isLowForm || a.acwr.status === "high_risk" || a.hasPlanningGap || a.unread > 0;

  const visibleAthletes = perAthlete.filter((a) => {
    if (activeFilter === "attention") return needsAttention(a);
    if (activeFilter === "today") return a.todayWorkouts.length > 0;
    return true;
  });

  const alerts = perAthlete.filter((a) => a.isLowForm || a.acwr.status === "high_risk");
  const planningGaps = perAthlete.filter((a) => a.hasPlanningGap);
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
          <p className="mb-6 text-slate">
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
                    <div
                      key={a.athleteId}
                      className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-gold-light/40 bg-gold-light/10 px-4 py-3 text-sm"
                    >
                      <span className="text-gold-light">⚠</span>
                      <Link href={`/coach/athletes/${a.athleteId}`} className="font-medium text-ink hover:underline">
                        {a.link.first_name} {a.link.last_name}
                      </Link>
                      <span className="text-ink-soft">
                        {a.isLowForm && `forme basse aujourd'hui — ${a.score}/10 (${scoreLabel(a.score as number)})`}
                        {a.isLowForm && a.acwr.status === "high_risk" && " · "}
                        {a.acwr.status === "high_risk" &&
                          `charge en hausse rapide (ratio ${a.acwr.ratio?.toFixed(2)})`}
                      </span>
                      <Link
                        href={`/coach/athletes/${a.athleteId}/messages`}
                        className="ml-auto whitespace-nowrap text-xs font-semibold text-moss-dark hover:underline"
                      >
                        Écrire →
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {planningGaps.length > 0 && (
                <Card className="mb-6 rounded-3xl">
                  <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Rien de programmé</h2>
                  <p className="mb-3 text-xs text-slate">Ces athlètes n&apos;ont aucune séance prévue dans les 7 prochains jours.</p>
                  <ul className="flex flex-col gap-2">
                    {planningGaps.map((a) => (
                      <li key={a.athleteId} className="flex flex-wrap items-center gap-2 text-sm">
                        <Avatar userId={a.athleteId} firstName={a.link.first_name || "?"} hasAvatar={!!a.link.avatar_path} size="sm" />
                        <Link href={`/coach/athletes/${a.athleteId}`} className="text-ink hover:underline">
                          {a.link.first_name} {a.link.last_name}
                        </Link>
                        <span className="text-xs text-slate">
                          {a.daysToNext === null ? "aucune séance à venir" : `prochaine dans ${a.daysToNext} jours`}
                        </span>
                        <Link
                          href={`/coach/athletes/${a.athleteId}/new-workout`}
                          className="ml-auto whitespace-nowrap rounded-full bg-moss px-3 py-1 text-xs font-semibold text-white hover:bg-moss-dark"
                        >
                          + Programmer
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
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

              {unvalidated.length > 0 && (
                <Card className="mb-6 rounded-3xl">
                  <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Séances à valider</h2>
                  <p className="mb-3 text-xs text-slate">Séances passées restées sans retour de l&apos;athlète, ou marquées non réalisées.</p>
                  <ul className="flex flex-col gap-2">
                    {unvalidated.map((w) => (
                      <li key={w.id}>
                        <Link href={`/workouts/${w.id}`} className="flex flex-wrap items-center gap-2 text-sm hover:underline">
                          <Avatar userId={w.athlete_id} firstName={w.first_name || "?"} hasAvatar={!!w.avatar_path} size="sm" />
                          <span className="text-ink">{w.first_name}</span>
                          <span className="text-ink-soft">{w.title}</span>
                          <span className="text-xs text-slate">{w.date}</span>
                          <span className="ml-auto">
                            <StatusBadge status={w.status} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {recentComments.length > 0 && (
                <Card className="mb-6 rounded-3xl">
                  <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Retours récents des athlètes</h2>
                  <ul className="flex flex-col gap-3">
                    {recentComments.map((c) => (
                      <li key={c.id}>
                        <Link href={`/workouts/${c.workout_id}`} className="block text-sm hover:underline">
                          <span className="flex flex-wrap items-center gap-2">
                            <Avatar userId={c.athlete_id} firstName={c.first_name || "?"} hasAvatar={!!c.avatar_path} size="sm" />
                            <span className="text-ink">{c.first_name}</span>
                            <span className="text-xs text-slate">sur « {c.workout_title} »</span>
                          </span>
                          <span className="mt-1 block pl-8 text-ink-soft">{c.body}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate">Mes athlètes</h2>
                  <div className="flex rounded-2xl bg-paper-dim p-1">
                    {FILTERS.map((f) => (
                      <Link
                        key={f.value}
                        href={`/coach/dashboard?filtre=${f.value}`}
                        scroll={false}
                        className={`rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${
                          activeFilter === f.value ? "bg-white text-ink shadow-sm" : "text-slate"
                        }`}
                      >
                        {f.label}
                      </Link>
                    ))}
                  </div>
                </div>
                {visibleAthletes.length === 0 ? (
                  <p className="text-sm text-slate">Aucun athlète ne correspond à ce filtre.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {visibleAthletes.map((a) => (
                      <Link
                        key={a.athleteId}
                        href={`/coach/athletes/${a.athleteId}`}
                        className="flex items-center gap-2.5 rounded-2xl bg-paper-dim px-3 py-2.5 text-sm hover:bg-line/40"
                      >
                        <Avatar userId={a.athleteId} firstName={a.link.first_name || "?"} hasAvatar={!!a.link.avatar_path} size="sm" />
                        <span className="min-w-0 truncate text-ink">
                          {a.link.first_name} {a.link.last_name}
                        </span>
                        {needsAttention(a) && <span className="shrink-0 text-xs text-gold-light">●</span>}
                        <span className="ml-auto shrink-0 text-xs text-slate">
                          {a.score !== null ? `${a.score}/10` : "—"}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
