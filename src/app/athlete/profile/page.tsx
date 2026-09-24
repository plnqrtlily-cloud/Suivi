import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getMeasurementsForAthlete,
  getLatestMeasurements,
  getInjuriesForAthlete,
  getPersonalRecordsForAthlete,
  getUserGender,
  getAthleteSports,
  getUserAvatar,
  profileCompletion,
  getExerciseMaxes,
} from "@/lib/queries";
import { addMeasurementAction, addInjuryAction, setGenderAction, setAthleteSportsAction } from "@/lib/actions";
import { AvatarUpload } from "./avatar-upload";
import { getCycleSettings, getCycleEntries, estimateCyclePhase } from "@/lib/cycle";
import { computeHrZones } from "@/lib/hr-zones";
import { computePowerZones } from "@/lib/power-zones";
import { computePaceZones } from "@/lib/pace-zones";
import { ZoneGrid, formatPaceValue } from "@/components/zone-grid";
import { todayISO } from "@/lib/dates";
import { PERFORMANCE_METRICS, MEASUREMENT_DEVICES, computeDerivedMetrics, groupMetrics } from "@/lib/performance-metrics";
import { Nav } from "@/components/nav";
import { Card, Field, SelectField, Button, sportLabel } from "@/components/ui";
import { CyclePanel } from "./cycle-panel";
import { PerformanceStats, MeasurementPoint } from "./performance-stats";
import { ExerciseMaxesPanel } from "@/app/coach/athletes/[athleteId]/exercise-maxes-panel";
import { MeasurementsHistory } from "@/app/coach/athletes/[athleteId]/measurements-history";
import { InjuriesList } from "./injuries-list";

function formatPace(minPerKm: number): string {
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}

// Liste partagée avec la fiche coach (src/lib/performance-metrics.ts) —
// inclut seuil lactique et lactatémie en plus des mesures historiques.
const METRICS = PERFORMANCE_METRICS.map((m) => ({
  value: m.value,
  label: m.unit ? `${m.label} (${m.unit})` : m.label,
  group: m.group,
}));

const SPORTS_LIST = [
  { value: "running", label: "Course à pied" },
  { value: "cycling", label: "Vélo" },
  { value: "hiking", label: "Randonnée" },
  { value: "swimming", label: "Natation" },
  { value: "climbing", label: "Escalade" },
  { value: "strength", label: "Musculation" },
  { value: "other", label: "Autre" },
];

export default async function AthleteProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");

  // Requêtes indépendantes parties en parallèle plutôt qu'en série (chacune est
  // un aller-retour réseau vers la base distante en production — les enchaîner
  // une par une multipliait la latence de la page par leur nombre).
  const [latest, historyAll, injuries, completion, gender, athleteSports, avatar, personalRecords, exerciseMaxes] =
    await Promise.all([
      getLatestMeasurements(user.id),
      getMeasurementsForAthlete(user.id),
      getInjuriesForAthlete(user.id),
      profileCompletion(user.id),
      getUserGender(user.id),
      getAthleteSports(user.id),
      getUserAvatar(user.id),
      getPersonalRecordsForAthlete(user.id),
      getExerciseMaxes(user.id),
    ]);
  const seriesByMetric: Record<string, MeasurementPoint[]> = {};
  for (const h of historyAll as any[]) {
    (seriesByMetric[h.metric] ??= []).push({ value: h.value, recorded_at: h.recorded_at });
  }
  for (const key in seriesByMetric) {
    seriesByMetric[key].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  }

  // Indicateurs dérivés : calculés uniquement à partir de mesures partageant la
  // MÊME date, pour ne pas croiser un poids de janvier avec une FC max de juin.
  // On retient la date la plus récente qui porte au moins une mesure.
  const byDate = new Map<string, Record<string, number>>();
  for (const h of historyAll as any[]) {
    const day = h.recorded_at.slice(0, 10);
    if (!byDate.has(day)) byDate.set(day, {});
    const bucket = byDate.get(day)!;
    if (!(h.metric in bucket)) bucket[h.metric] = h.value;
  }
  const latestDay = [...byDate.keys()].sort().reverse()[0];
  const derivedMetrics = latestDay ? computeDerivedMetrics(byDate.get(latestDay)!) : [];

  const [cycleSettings, cycleEstimate, cycleEntries] =
    gender === "female"
      ? await Promise.all([getCycleSettings(user.id), estimateCyclePhase(user.id), getCycleEntries(user.id)])
      : [null, null, []];

  return (
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
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

          <div className="mt-5 border-t border-line pt-5">
            <p className="mb-2 text-sm font-medium text-ink">Sport(s) pratiqué(s)</p>
            <p className="mb-3 text-xs text-slate">Visible par vos coachs, pour mieux cadrer votre suivi.</p>
            <form action={setAthleteSportsAction} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                {SPORTS_LIST.map((s) => (
                  <label key={s.value} className="flex items-center gap-1.5 text-sm text-ink-soft">
                    <input type="checkbox" name="sports" value={s.value} defaultChecked={athleteSports.includes(s.value)} />
                    {s.label}
                  </label>
                ))}
              </div>
              <div>
                <Button type="submit" variant="secondary">
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        </Card>

        <Card className="mb-8 rounded-3xl">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Statistiques de performance</h2>
          <p className="mb-3 text-xs text-slate">Cliquez sur un indicateur pour voir son évolution.</p>
          <PerformanceStats metrics={METRICS} latest={latest} seriesByMetric={seriesByMetric} />
          <form action={addMeasurementAction} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <SelectField label="Indicateur" name="metric" required>
              {groupMetrics(METRICS).map(({ group, items }) => (
                <optgroup key={group} label={group}>
                  {items.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectField>
            <Field label="Valeur" type="number" step="0.1" name="value" required />
            <Field label="Date de la mesure" type="date" name="recordedAt" defaultValue={todayISO()} />
            <SelectField label="Appareil utilisé" name="device">
              {MEASUREMENT_DEVICES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </SelectField>
            <Field label="Note (facultatif)" name="note" placeholder="Contexte, conditions de la mesure…" />
            <div className="sm:col-span-2">
              <Button type="submit">Ajouter une mesure</Button>
            </div>
          </form>
          {derivedMetrics.length > 0 && (
            <div className="mt-4 rounded-2xl bg-paper-dim p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate">
                Calculé automatiquement <span className="font-normal normal-case">— mesures du {latestDay}</span>
              </p>
              <ul className="flex flex-col gap-2">
                {derivedMetrics.map((d) => (
                  <li key={d.label} className="text-sm">
                    <span className="text-ink-soft">{d.label} : </span>
                    <span className="font-semibold text-ink">{d.value}</span>
                    <p className="text-xs text-slate">{d.explanation}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {historyAll.length > 0 && (
            <details className="mt-4 text-sm text-slate">
              <summary className="cursor-pointer">Historique des mesures</summary>
              <div className="mt-2">
                <MeasurementsHistory athleteId={user.id} history={historyAll} metrics={METRICS} />
              </div>
            </details>
          )}
        </Card>

        <Card className="mb-8 rounded-3xl">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Charges de référence</h2>
          <p className="mb-3 text-xs text-slate">
            Vos maximums testés par exercice (charge, durée ou répétitions) — sert de repère à votre coach pour
            prescrire une charge adaptée, et vous montre votre propre progression.
          </p>
          <ExerciseMaxesPanel athleteId={user.id} maxes={exerciseMaxes} exerciseSuggestions={[]} />
        </Card>

        <Card className="mb-8 rounded-3xl">
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Zones d&apos;entraînement</h2>
          <p className="mb-4 text-xs text-slate">
            Calculées automatiquement à partir des mesures renseignées ci-dessus — chaque type de zone apparaît dès que
            les données nécessaires existent.
          </p>

          {latest.fc_repos && latest.fc_max ? (
            <div className="mb-5">
              <h3 className="mb-2 text-xs font-semibold text-ink-soft">
                Fréquence cardiaque{" "}
                <span className="font-normal text-slate">
                  — méthode de Karvonen (FC repos {latest.fc_repos.value}, FC max {latest.fc_max.value})
                </span>
              </h3>
              <ZoneGrid
                zones={computeHrZones(latest.fc_repos.value, latest.fc_max.value).map((z) => ({
                  zone: z.zone,
                  label: z.label,
                  range: `${z.minBpm}-${z.maxBpm}`,
                }))}
              />
            </div>
          ) : (
            <p className="mb-5 text-sm text-slate">
              Renseignez votre FC repos et votre FC max pour voir vos zones cardiaques.
            </p>
          )}

          {latest.ftp ? (
            <div className="mb-5">
              <h3 className="mb-2 text-xs font-semibold text-ink-soft">
                Puissance <span className="font-normal text-slate">— en % de votre FTP ({latest.ftp.value} W)</span>
              </h3>
              <ZoneGrid
                zones={computePowerZones(latest.ftp.value).map((z) => ({
                  zone: z.zone,
                  label: z.label,
                  range: `${z.minW}-${z.maxW} W`,
                }))}
              />
            </div>
          ) : (
            <p className="mb-5 text-sm text-slate">Renseignez votre FTP pour voir vos zones de puissance.</p>
          )}

          {latest.pma_vma ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-ink-soft">
                Allure <span className="font-normal text-slate">— à partir de votre PMA/VMA ({latest.pma_vma.value})</span>
              </h3>
              <ZoneGrid
                zones={computePaceZones(latest.pma_vma.value).map((z) => ({
                  zone: z.zone,
                  label: z.label,
                  range: `${formatPaceValue(z.minPaceMinPerKm)}-${formatPaceValue(z.maxPaceMinPerKm)}`,
                }))}
              />
            </div>
          ) : (
            <p className="text-sm text-slate">Renseignez votre PMA/VMA pour voir vos zones d&apos;allure.</p>
          )}
        </Card>

        <Card className="mb-8 rounded-3xl">
          <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate">Antécédents de blessures</h2>
          <InjuriesList injuries={injuries} />
          <form action={addInjuryAction} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Zone" name="zone" required placeholder="ex. Genou droit" />
            <Field label="Description" name="description" placeholder="ex. Tendinite" />
            <Field label="Date de début" type="date" name="dateStart" required />
            <Field label="Date de fin (si guéri)" type="date" name="dateEnd" />
            <div className="col-span-2">
              <Button type="submit">Ajouter</Button>
            </div>
          </form>
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

      </main>
    </div>
  );
}
