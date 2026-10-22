// Zones d'entraînement de l'athlète, calculées exactement comme sur sa fiche
// côté coach (seuils d'un test de labo, sinon FC / FTP / PMA / VMA, puis les
// bornes ajustées à la main par le coach), et temps passé par zone sur 28 jours.
import { getLatestMeasurements, getMeasurementsForAthlete, getEffortTestBatchesForAthlete, getZoneOverrides, getImportedActivitiesForRange, getWorkoutsForAthlete } from "./queries";
import { autoZones, parseCuts, zoneOf, type Cuts } from "./training-zones";
import { todayISO } from "./dates";

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function getAthleteZones(athleteId: string) {
  const today = todayISO();
  const from = addDays(today, -27);
  const [latest, history, batches, overrides, imports, workouts] = await Promise.all([
    getLatestMeasurements(athleteId),
    getMeasurementsForAthlete(athleteId),
    getEffortTestBatchesForAthlete(athleteId),
    getZoneOverrides(athleteId),
    getImportedActivitiesForRange(athleteId, from, today),
    getWorkoutsForAthlete(athleteId, from, today),
  ]);
  const lastOf = (metric: string, ok: (v: number) => boolean = () => true) =>
    (history as { metric: string; value: number; recorded_at: string }[])
      .filter((x) => x.metric === metric && ok(x.value))
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]?.value;
  const sv = batches.find((b) => b.data.sv1_bpm || b.data.sv2_bpm || b.data.sv2_w);
  const auto = autoZones({
    fcRepos: latest.fc_repos?.value,
    fcMax: latest.fc_max?.value,
    ftp: latest.ftp?.value,
    pma: lastOf("pma_vma", (v) => v > 60),
    vma: lastOf("pma_vma", (v) => v <= 60),
    sv: sv ? { sv1w: sv.data.sv1_w, sv2w: sv.data.sv2_w, sv1hr: sv.data.sv1_bpm, sv2hr: sv.data.sv2_bpm, date: sv.testDate, label: "" } : undefined,
  });
  const hr = parseCuts(overrides?.hr_json) ?? auto.hr;
  const pw = parseCuts(overrides?.pw_json) ?? auto.pw;
  const pace = parseCuts(overrides?.pace_json) ?? auto.pace;

  // Temps par zone : FC moyenne de chaque séance faite ou activité ajoutée
  // (à défaut, puissance moyenne), sur les 4 dernières semaines.
  const linked = new Set(imports.map((a) => a.workout_id).filter(Boolean));
  const acts = [
    ...imports.map((a) => ({ min: a.duration_minutes ?? 0, hr: a.avg_hr, pw: a.avg_power_w })),
    ...workouts.filter((w) => w.status === "done" && !linked.has(w.id)).map((w) => ({ min: w.actual_duration_minutes ?? w.duration_minutes ?? 0, hr: w.avg_hr, pw: w.avg_power_w })),
  ].filter((a) => a.min > 0);
  const minutes = [0, 0, 0, 0, 0];
  for (const a of acts) {
    const z = a.hr && hr ? zoneOf(a.hr, hr) : a.pw && pw ? zoneOf(a.pw, pw) : null;
    if (z != null) minutes[z] += a.min;
  }
  return {
    zones: { hr, pw, pace } as { hr: Cuts | null; pw: Cuts | null; pace: Cuts | null },
    source: auto.source,
    adjusted: !!(overrides?.hr_json || overrides?.pw_json || overrides?.pace_json),
    minutes,
    latest,
  };
}
