import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getAthletesForCoach,
  getWorkoutsForAthlete,
  getRecentCheckins,
  getUnreadMessageCount,
  getJournalForAthlete,
} from "@/lib/queries";
import { getRosterSignals, signalScore, type RosterSignals } from "@/lib/roster-signals";
import { todayISO } from "@/lib/dates";
import { computeGlobalScore, scoreLabel } from "@/lib/checkin-types";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui";
import { sportIconPath } from "@/lib/sport-icons";

const FILTERS = [
  { value: "all", label: "Tous" },
  { value: "attention", label: "À surveiller" },
  { value: "today", label: "Séance aujourd'hui" },
];

// Une carte par athlète regroupant tout ce qui le concerne aujourd'hui —
// disposition validée en maquette : grille de cartes plutôt qu'une liste de
// lignes, chaque carte se lisant d'un coup d'œil.
function AthleteCard({
  athleteId,
  link,
  todayWorkouts,
  score,
  checkinNote,
  journalNote,
  signals,
  unread,
  today,
}: {
  athleteId: string;
  link: any;
  todayWorkouts: any[];
  score: number | null;
  checkinNote: string | null;
  journalNote: string | null;
  signals: RosterSignals;
  unread: number;
  today: string;
}) {
  const alerts: string[] = [];
  if (signals.acwrHighRisk) alerts.push(`charge en hausse rapide (${signals.acwrRatio?.toFixed(2)})`);
  if (signals.missedRecently > 0) alerts.push(`${signals.missedRecently} séance(s) non réalisée(s)`);
  if (signals.unvalidatedRecently > 0) alerts.push(`${signals.unvalidatedRecently} séance(s) sans retour`);
  if (signals.daysUntilNextWorkout === null) alerts.push("plus rien de programmé");
  else if (signals.daysUntilNextWorkout > 7) alerts.push(`prochaine séance dans ${signals.daysUntilNextWorkout} j`);

  const sharedNote = checkinNote || journalNote;

  return (
    <div
      className={`flex flex-col rounded-3xl border bg-white p-4 ${
        alerts.length > 0 ? "border-gold-light/50" : "border-line"
      }`}
    >
      {/* En-tête : identité */}
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar userId={athleteId} firstName={link.first_name || "?"} hasAvatar={!!link.avatar_path} size="lg" />
        <div className="min-w-0">
          <Link href={`/coach/athletes/${athleteId}`} className="block truncate font-medium text-ink hover:underline">
            {link.first_name} {link.last_name}
          </Link>
          {unread > 0 && (
            <Link href={`/coach/athletes/${athleteId}/messages`} className="text-xs font-semibold text-moss-dark hover:underline">
              {unread} message{unread > 1 ? "s" : ""} non lu{unread > 1 ? "s" : ""}
            </Link>
          )}
        </div>
      </div>

      {/* Deux lignes d'information, comme dans la maquette validée */}
      <dl className="mb-3 flex flex-col gap-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-slate">Forme</dt>
          <dd className="text-right font-medium text-ink">
            {score !== null ? (
              <>
                {score}/10 <span className="text-xs font-normal text-slate">({scoreLabel(score)})</span>
              </>
            ) : (
              <span className="text-xs font-normal text-slate">non renseignée</span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="shrink-0 text-slate">Aujourd&apos;hui</dt>
          <dd className="min-w-0 text-right font-medium text-ink">
            {todayWorkouts.length > 0 ? (
              <Link href={`/coach/athletes/${athleteId}/day/${today}`} className="flex items-center justify-end gap-1.5 hover:underline">
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke={todayWorkouts[0].color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d={sportIconPath(todayWorkouts[0].sport)} />
                </svg>
                <span className="truncate">
                  {todayWorkouts[0].title}
                  {todayWorkouts.length > 1 && ` +${todayWorkouts.length - 1}`}
                </span>
              </Link>
            ) : (
              <span className="text-xs font-normal text-slate">repos</span>
            )}
          </dd>
        </div>
      </dl>

      {/* Note partagée par l'athlète, en bulle de message */}
      {sharedNote && (
        <p className="mb-3 rounded-2xl rounded-tl-sm bg-paper-dim px-3 py-2 text-sm text-ink-soft">
          <span className="mr-1">💬</span>
          {sharedNote}
        </p>
      )}

      {alerts.length > 0 && <p className="mb-3 text-xs text-gold-light">⚠ {alerts.join(" · ")}</p>}

      <Link
        href={`/coach/athletes/${athleteId}/new-workout`}
        className="mt-auto rounded-full border border-line px-3 py-1.5 text-center text-xs font-semibold text-moss-dark hover:border-moss"
      >
        + Programmer une séance
      </Link>
    </div>
  );
}

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

  const links = await getAthletesForCoach(user.id);
  const activeAthletes = links.filter((l) => l.status === "active" && l.athlete_id);

  const rows = await Promise.all(
    activeAthletes.map(async (l) => {
      const athleteId = l.athlete_id as string;
      const [todayWorkouts, checkins, unread, signals, journal] = await Promise.all([
        getWorkoutsForAthlete(athleteId, today, today),
        getRecentCheckins(athleteId, 1),
        getUnreadMessageCount(user.id, athleteId, user.id),
        getRosterSignals(athleteId, today),
        getJournalForAthlete(athleteId, today),
      ]);
      const checkin = checkins[0];
      const isToday = checkin?.check_date === today;
      return {
        athleteId,
        link: l,
        todayWorkouts,
        score: checkin && isToday ? computeGlobalScore(checkin) : null,
        checkinNote: isToday ? checkin?.notes ?? null : null,
        journalNote: (journal[0] as any)?.content ?? null,
        signals,
        unread,
      };
    })
  );

  // Les athlètes qui demandent attention remontent en tête — le coach n'a pas
  // à parcourir toute la liste pour trouver ce qui ne va pas.
  rows.sort((a, b) => signalScore(b.signals) - signalScore(a.signals));

  const needsAttention = (r: (typeof rows)[number]) =>
    signalScore(r.signals) > 0 || r.unread > 0 || (r.score !== null && r.score < 5);

  const visible = rows.filter((r) => {
    if (activeFilter === "attention") return needsAttention(r);
    if (activeFilter === "today") return r.todayWorkouts.length > 0;
    return true;
  });

  const attentionCount = rows.filter(needsAttention).length;

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/dashboard" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="mb-1 font-display text-3xl text-ink">Mes athlètes</h1>
          <p className="mb-6 text-slate">
            {activeAthletes.length} athlète{activeAthletes.length > 1 ? "s" : ""} suivi{activeAthletes.length > 1 ? "s" : ""}
            {" · "}
            {new Date(`${today}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            {attentionCount > 0 && (
              <>
                {" · "}
                <span className="font-medium text-gold-light">
                  {attentionCount} à surveiller
                </span>
              </>
            )}
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
              <div className="mb-4 flex w-fit rounded-2xl bg-paper-dim p-1">
                {FILTERS.map((f) => (
                  <Link
                    key={f.value}
                    href={`/coach/dashboard?filtre=${f.value}`}
                    scroll={false}
                    className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      activeFilter === f.value ? "bg-white text-ink shadow-sm" : "text-slate"
                    }`}
                  >
                    {f.label}
                  </Link>
                ))}
              </div>

              {visible.length === 0 ? (
                <Card className="rounded-3xl">
                  <p className="text-sm text-slate">Aucun athlète ne correspond à ce filtre.</p>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((r) => (
                    <AthleteCard key={r.athleteId} {...r} today={today} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
