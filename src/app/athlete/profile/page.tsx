import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getMeasurementsForAthlete,
  getLatestMeasurements,
  getInjuriesForAthlete,
  getJournalForAthlete,
  getExternalConnections,
  getImportedActivities,
  getUserGender,
  getUserAvatar,
  profileCompletion,
} from "@/lib/queries";
import { addMeasurementAction, addInjuryAction, addJournalEntryAction, setGenderAction } from "@/lib/actions";
import { AvatarUpload } from "./avatar-upload";
import { getCycleSettings, getCycleEntries, estimateCyclePhase } from "@/lib/cycle";
import { Nav } from "@/components/nav";
import { Card, Field, SelectField, TextAreaField, Button } from "@/components/ui";
import { CyclePanel } from "./cycle-panel";
import { SyncPanel } from "./sync-panel";
import { PerformanceStats, MeasurementPoint } from "./performance-stats";

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

  const latest = await getLatestMeasurements(user.id);
  const historyAll = await getMeasurementsForAthlete(user.id);
  const history = historyAll.slice(0, 10);
  const seriesByMetric: Record<string, MeasurementPoint[]> = {};
  for (const h of historyAll as any[]) {
    (seriesByMetric[h.metric] ??= []).push({ value: h.value, recorded_at: h.recorded_at });
  }
  for (const key in seriesByMetric) {
    seriesByMetric[key].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  }
  const injuries = await getInjuriesForAthlete(user.id);
  const journal = await getJournalForAthlete(user.id);
  const completion = await profileCompletion(user.id);
  const gender = await getUserGender(user.id);
  const avatar = await getUserAvatar(user.id);
  const externalConnections = await getExternalConnections(user.id);
  const importedActivities = await getImportedActivities(user.id);
  const cycleSettings = gender === "female" ? await getCycleSettings(user.id) : null;
  const cycleEstimate = gender === "female" ? await estimateCyclePhase(user.id) : null;
  const cycleEntries = gender === "female" ? await getCycleEntries(user.id) : [];

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
          <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate">Journal de bord</h2>
          <ul className="mb-4 space-y-2 text-sm">
            {journal.map((j) => (
              <li key={j.id} className="rounded-xl bg-paper-dim p-2">
                <span className="text-slate">{j.entry_date} — </span>
                <span className="text-ink">{j.content}</span>
              </li>
            ))}
            {journal.length === 0 && <p className="text-slate">Aucune entrée pour l&apos;instant.</p>}
          </ul>
          <form action={addJournalEntryAction} className="flex flex-col gap-3">
            <Field label="Date" type="date" name="entryDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
            <TextAreaField label="Note" name="content" rows={3} required placeholder="Sensations du jour, fatigue, contexte particulier…" />
            <div>
              <Button type="submit">Ajouter une entrée</Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
