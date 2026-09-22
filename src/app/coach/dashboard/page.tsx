import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getAthletesForCoach,
  getCoachReminders,
  getCoachPlan,
} from "@/lib/queries";
import { FREE_PLAN_ATHLETE_LIMIT } from "@/lib/billing";
import { computeRosterSignals, signalScore, type RosterSignals } from "@/lib/roster-signals";
import { loadDashboardBatch } from "@/lib/dashboard-batch";
import { todayISO, toISODate } from "@/lib/dates";
import { computeGlobalScore, scoreLabel } from "@/lib/checkin-types";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui";
import { CoachReminders } from "./coach-reminders";
import { InviteForm } from "../invite-form";
import { RevokeButton } from "../revoke-button";
import { sportIconPath } from "@/lib/sport-icons";


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

export default async function CoachDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const today = todayISO();

  const [links, reminders, plan] = await Promise.all([
    getAthletesForCoach(user.id),
    getCoachReminders(user.id),
    getCoachPlan(user.id),
  ]);
  const activeAthletes = links.filter((l) => l.status === "active" && l.athlete_id);
  // Invitations envoyées mais pas encore acceptées — sinon le coach n'a aucun
  // moyen de savoir qu'elles sont en attente, ni de les annuler.
  const pendingInvites = links.filter((l) => l.status === "pending");

  // Tout l'effectif chargé en une poignée de requêtes plutôt que huit par
  // athlète : à 30 athlètes, l'ancienne version faisait 240 allers-retours.
  const acwrFrom = new Date();
  acwrFrom.setDate(acwrFrom.getDate() - 27);
  const recentFrom = new Date();
  recentFrom.setDate(recentFrom.getDate() - 13);
  const recentFromISO = toISODate(recentFrom);

  const batch = await loadDashboardBatch(
    user.id,
    activeAthletes.map((l) => l.athlete_id as string),
    today,
    toISODate(acwrFrom),
    recentFromISO
  );

  const rows = activeAthletes.map((l) => {
    const athleteId = l.athlete_id as string;
    const checkin = batch.checkinByAthlete.get(athleteId);
    const isToday = checkin?.check_date === today;
    return {
      athleteId,
      link: l,
      todayWorkouts: batch.workoutsByAthlete.get(athleteId) ?? [],
      score: checkin && isToday ? computeGlobalScore(checkin) : null,
      checkinNote: isToday ? checkin?.notes ?? null : null,
      journalNote: batch.journalByAthlete.get(athleteId) ?? null,
      signals: computeRosterSignals({
        allWorkouts: batch.lastWorkoutsByAthlete.get(athleteId) ?? [],
        imports: batch.importsByAthlete.get(athleteId) ?? [],
        lastCheckinDate: checkin?.check_date ?? null,
        today,
        recentFromISO,
      }),
      unread: batch.unreadByAthlete.get(athleteId) ?? 0,
    };
  });

  // Les athlètes qui demandent attention remontent en tête — le coach n'a pas
  // à parcourir toute la liste pour trouver ce qui ne va pas.
  rows.sort((a, b) => signalScore(b.signals) - signalScore(a.signals));

  const needsAttention = (r: (typeof rows)[number]) =>
    signalScore(r.signals) > 0 || r.unread > 0 || (r.score !== null && r.score < 5);

  const visible = rows;

  const attentionCount = rows.filter(needsAttention).length;

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/dashboard" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
          <h1 className="mb-1 font-display text-3xl text-ink">Mes athlètes</h1>
          <p className={plan === "pro" ? "mb-6 text-slate" : "mb-1 text-slate"}>
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
          {plan !== "pro" && (
            <p className="mb-6 text-xs text-slate">
              Offre gratuite — {links.length}/{FREE_PLAN_ATHLETE_LIMIT} athlètes.{" "}
              <Link href="/tarifs" className="font-semibold text-moss-dark hover:underline">
                Passer au plan Pro
              </Link>
            </p>
          )}

          {activeAthletes.length === 0 ? (
            /* Premier lancement : le formulaire d'invitation directement, plutôt
               qu'un message renvoyant vers une page à trouver. */
            <Card className="rounded-3xl">
              <h2 className="mb-1 font-display text-xl text-ink">Invitez votre premier athlète</h2>
              <p className="mb-4 text-sm text-slate">
                Générez un lien d&apos;invitation et transmettez-le. Dès qu&apos;il crée son compte, vous pourrez lui
                programmer des séances et suivre sa forme au jour le jour.
              </p>
              <InviteForm />
              {pendingInvites.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                  {pendingInvites.map((link) => (
                    <div key={link.link_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-ink-soft">
                        En attente — {link.invite_email || "lien partagé sans email précisé"}
                      </span>
                      <RevokeButton linkId={link.link_id} label="Annuler" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <>
              <Card className="mb-4 rounded-3xl">
                <CoachReminders
                  reminders={reminders}
                  athletes={activeAthletes.map((a: any) => ({
                    id: a.athlete_id as string,
                    name: `${a.first_name} ${a.last_name}`,
                  }))}
                />
              </Card>

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

              {/* Invitation : accessible depuis la page d'accueil du coach, la
                  liste « Mes athlètes » ayant été retirée de la navigation. */}
              {pendingInvites.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {pendingInvites.map((link) => (
                    <div
                      key={link.link_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper-dim px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink-soft">Invitation en attente</p>
                        <p className="text-xs text-slate">{link.invite_email || "Lien partagé sans email précisé"}</p>
                      </div>
                      <RevokeButton linkId={link.link_id} label="Annuler" />
                    </div>
                  ))}
                </div>
              )}

              <Card className="mt-4 rounded-3xl">
                <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Inviter un athlète</h2>
                <InviteForm />
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
