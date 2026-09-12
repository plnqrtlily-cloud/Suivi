import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getMeasurementsForAthlete,
  getLatestMeasurements,
  getInjuriesForAthlete,
  getCoachesForAthlete,
  getExternalConnections,
  getImportedActivities,
  getPersonalRecordsForAthlete,
  getUserGender,
  getUserAvatar,
  profileCompletion,
} from "@/lib/queries";
import { addMeasurementAction, addInjuryAction, setGenderAction } from "@/lib/actions";
import { AvatarUpload } from "./avatar-upload";
import { getCycleSettings, getCycleEntries, estimateCyclePhase } from "@/lib/cycle";
import { computeHrZones } from "@/lib/hr-zones";
import { Nav } from "@/components/nav";
import { Card, Field, SelectField, Button, sportLabel } from "@/components/ui";
import { CyclePanel } from "./cycle-panel";
import { SyncPanel } from "./sync-panel";
import { PerformanceStats, MeasurementPoint } from "./performance-stats";
import { RevokeButton } from "@/app/coach/revoke-button";
import { JoinCoachForm } from "../join-coach-form";

function formatPace(minPerKm: number): string {
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}

const METRICS = [
  { value: "weight_kg", label: "Poids (kg)" },
  { value: "height_cm", label: "Taille (cm)" },
  { value: "fc_repos", label: "FC repos (bpm)" },
  { value: "fc_max", label: "FC max (bpm)" },
  { value: "vo2max", label: "VO2max" },
  { value: "ftp", label: "FTP (W)" },
  { value: "pma_vma", label: "PMA/VMA" },
];

export default async function AthleteProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach");

  // Requêtes indépendantes parties en parallèle plutôt qu'en série (chacune est
  // un aller-retour réseau vers la base distante en production — les enchaîner
  // une par une multipliait la latence de la page par leur nombre).
  const [latest, historyAll, injuries, coaches, completion, gender, avatar, externalConnections, importedActivities, personalRecords] =
    await Promise.all([
      getLatestMeasurements(user.id),
      getMeasurementsForAthlete(user.id),
      getInjuriesForAthlete(user.id),
      getCoachesForAthlete(user.id),
      profileCompletion(user.id),
      getUserGender(user.id),
      getUserAvatar(user.id),
      getExternalConnections(user.id),
      getImportedActivities(user.id),
      getPersonalRecordsForAthlete(user.id),
    ]);
  const history = historyAll.slice(0, 10);
  const seriesByMetric: Record<string, MeasurementPoint[]> = {};
  for (const h of historyAll as any[]) {
    (seriesByMetric[h.metric] ??= []).push({ value: h.value, recorded_at: h.recorded_at });
  }
  for (const key in seriesByMetric) {
    seriesByMetric[key].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  }

  const [cycleSettings, cycleEstimate, cycleEntries] =
    gender === "female"
      ? await Promise.all([getCycleSettings(user.id), estimateCyclePhase(user.id), getCycleEntries(user.id)])
      : [null, null, []];

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-1 font-display text-3xl text-ink">Mon profil</h1>
        <p className="mb-8 text-slate">Profil complété à {completion}% — visible par vos coachs actifs.</p>

        <Card className="mb-8 rounded-3xl">
          <AvatarUpload userId={user.id} firstName={user.first_name} hasAvatar={!!avatar?.avatar_path} />
        </Card>

        <Card className="mb-8 rounded-3xl">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Informations générales</h2>
          <p className="mb-3 text-xs text-slate">
            Le genre conditionne l&apos;accès aux fonctionnalités de cycle menstruel ci-dessous.
          </p>
          <form
            action={async (formData) => {
              "use server";
              await setGenderAction(formData);
            }}
            className="flex items-end gap-3"
          >
            <div className="w-56">
              <SelectField label="Genre" name="gender" defaultValue={gender || ""}>
                <option value="" disabled>
                  Sélectionner…
                </option>
                <option value="female">Féminin</option>
                <option value="male">Masculin</option>
                <option value="other">Autre</option>
                <option value="prefer_not_to_say">Préfère ne pas dire</option>
              </SelectField>
            </div>
            <Button type="submit" variant="secondary">
              Enregistrer
            </Button>
          </form>
        </Card>

        <Card className="mb-8 rounded-3xl">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Statistiques de performance</h2>
          <p className="mb-3 text-xs text-slate">Cliquez sur un indicateur pour voir son évolution.</p>
          <PerformanceStats metrics={METRICS} latest={latest} seriesByMetric={seriesByMetric} />
          <form action={addMeasurementAction} className="flex items-end gap-3">
            <div className="w-48">
              <SelectField label="Indicateur" name="metric" required>
                {METRICS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="w-32">
              <Field label="Valeur" type="number" step="0.1" name="value" required />
            </div>
            <Button type="submit">Ajouter une mesure</Button>
          </form>
          {history.length > 0 && (
            <details className="mt-4 text-sm text-slate">
              <summary className="cursor-pointer">Historique des mesures</summary>
              <ul className="mt-2 space-y-1">
                {history.map((h) => (
                  <li key={h.id}>
                    {h.recorded_at.slice(0, 10)} — {METRICS.find((m) => m.value === h.metric)?.label}: {h.value}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        {latest.fc_repos && latest.fc_max ? (
          <Card className="mb-8 rounded-3xl">
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Zones de fréquence cardiaque</h2>
            <p className="mb-4 text-xs text-slate">
              Calculées par méthode de Karvonen à partir de vos FC repos ({latest.fc_repos.value}) et FC max (
              {latest.fc_max.value}).
            </p>
            <div className="grid grid-cols-5 gap-2">
              {computeHrZones(latest.fc_repos.value, latest.fc_max.value).map((z) => (
                <div key={z.zone} className="rounded-xl bg-paper-dim p-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate">Z{z.zone}</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {z.minBpm}-{z.maxBpm}
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-tight text-slate">{z.label}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="mb-8 rounded-3xl bg-paper-dim">
            <p className="text-sm text-ink-soft">
              Renseignez votre FC repos et votre FC max ci-dessus pour voir apparaître vos zones cardiaques
              personnelles.
            </p>
          </Card>
        )}

        <Card className="mb-8 rounded-3xl">
          <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate">Antécédents de blessures</h2>
          <ul className="mb-4 space-y-2 text-sm">
            {injuries.map((i) => (
              <li key={i.id} className="rounded-xl bg-paper-dim p-2">
                <span className="font-medium text-ink">{i.zone}</span> — {i.description}{" "}
                <span className="text-slate">
                  ({i.date_start}
                  {i.date_end ? ` → ${i.date_end}` : ""})
                </span>
              </li>
            ))}
            {injuries.length === 0 && <p className="text-slate">Aucun antécédent renseigné.</p>}
          </ul>
          <form action={addInjuryAction} className="grid grid-cols-2 gap-3">
            <Field label="Zone" name="zone" required placeholder="ex. Genou droit" />
            <Field label="Description" name="description" placeholder="ex. Tendinite" />
            <Field label="Date de début" type="date" name="dateStart" required />
            <Field label="Date de fin (si guéri)" type="date" name="dateEnd" />
            <div className="col-span-2">
              <Button type="submit">Ajouter</Button>
            </div>
          </form>
        </Card>

        <Card className="mb-8 rounded-3xl">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Connexions & activités</h2>
          <p className="mb-4 text-xs text-slate">
            Statut toujours visible, jamais d&apos;échec silencieux. Strava et l&apos;import manuel restent
            disponibles indépendamment de Garmin.
          </p>
          <SyncPanel connections={externalConnections} activities={importedActivities} />
        </Card>

        {personalRecords.length > 0 && (
          <Card className="mb-8 rounded-3xl">
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Records personnels</h2>
            <p className="mb-4 text-xs text-slate">
              Calculés à partir de vos activités importées — plus longue distance, meilleure allure et plus longue
              durée, sport par sport.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {personalRecords.map((r) => (
                <div key={r.sport} className="rounded-2xl border border-line p-3.5">
                  <p className="mb-2 text-sm font-semibold text-ink">{sportLabel(r.sport)}</p>
                  <ul className="space-y-1 text-sm">
                    {r.bestDistanceKm !== null && (
                      <li className="flex items-baseline justify-between gap-2">
                        <span className="text-slate">Plus longue distance</span>
                        <span className="font-medium text-ink">
                          {r.bestDistanceKm} km <span className="text-xs text-slate">({r.bestDistanceDate})</span>
                        </span>
                      </li>
                    )}
                    {r.bestPaceMinPerKm !== null && (
                      <li className="flex items-baseline justify-between gap-2">
                        <span className="text-slate">Meilleure allure</span>
                        <span className="font-medium text-ink">
                          {formatPace(r.bestPaceMinPerKm)} <span className="text-xs text-slate">({r.bestPaceDate})</span>
                        </span>
                      </li>
                    )}
                    {r.bestDurationMinutes !== null && (
                      <li className="flex items-baseline justify-between gap-2">
                        <span className="text-slate">Plus longue durée</span>
                        <span className="font-medium text-ink">
                          {r.bestDurationMinutes} min <span className="text-xs text-slate">({r.bestDurationDate})</span>
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}

        {gender === "female" && cycleSettings && cycleEstimate ? (
          <Card className="mb-8 rounded-3xl">
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate">Cycle menstruel</h2>
            <CyclePanel settings={cycleSettings} estimate={cycleEstimate} entries={cycleEntries} />
          </Card>
        ) : (
          !gender && (
            <Card className="mb-8 rounded-3xl bg-paper-dim">
              <p className="text-sm text-ink-soft">
                Le suivi du cycle menstruel apparaît ici une fois le genre renseigné ci-dessus (profil féminin).
              </p>
            </Card>
          )
        )}

        <Card className="rounded-3xl">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">Mes coachs</h2>
          {coaches.length === 0 && <p className="text-sm text-slate">Aucun coach lié pour l&apos;instant.</p>}
          <ul className="mb-4 space-y-2 text-sm">
            {coaches.map((c) => (
              <li key={c.link_id} className="flex items-center justify-between">
                <span className="text-ink">
                  {c.first_name} {c.last_name} — {c.email}
                </span>
                <span className="flex items-center gap-2">
                  <Link
                    href={`/athlete/messages/${c.coach_id}`}
                    className="flex items-center gap-1 text-xs font-semibold text-moss-dark hover:underline"
                  >
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 5.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.5 3v-3H5a2 2 0 0 1-2-2z" />
                    </svg>
                    Discuter
                  </Link>
                  <RevokeButton linkId={c.link_id} label="Retirer l'accès" />
                </span>
              </li>
            ))}
          </ul>
          <JoinCoachForm />
        </Card>
      </main>
    </div>
  );
}
