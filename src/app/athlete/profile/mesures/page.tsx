import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMeasurementsForAthlete, getLatestMeasurements, getEffortTestBatchesForAthlete } from "@/lib/queries";
import { addMeasurementAction } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import { PERFORMANCE_METRICS, MEASUREMENT_DEVICES, computeDerivedMetrics, groupMetrics } from "@/lib/performance-metrics";
import { EFFORT_TEST_CATALOG } from "@/lib/effort-tests";
import { Field, SelectField, Button } from "@/components/ui";
import { PerformanceStats, type MeasurementPoint } from "../performance-stats";
import { MeasurementsHistory } from "@/app/coach/athletes/[athleteId]/measurements-history";
import { SubPage, Panel } from "../moi-ui";

const METRICS = PERFORMANCE_METRICS.map((m) => ({ value: m.value, label: m.unit ? `${m.label} (${m.unit})` : m.label, group: m.group }));

export default async function MesuresPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");

  const [latest, historyAll, batches] = await Promise.all([getLatestMeasurements(user.id), getMeasurementsForAthlete(user.id), getEffortTestBatchesForAthlete(user.id)]);
  const history = historyAll as { metric: string; value: number; recorded_at: string }[];
  const seriesByMetric: Record<string, MeasurementPoint[]> = {};
  for (const h of history) (seriesByMetric[h.metric] ??= []).push({ value: h.value, recorded_at: h.recorded_at });
  for (const k in seriesByMetric) seriesByMetric[k].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  // Indicateurs dérivés à partir de mesures d'une même date seulement.
  const byDate = new Map<string, Record<string, number>>();
  for (const h of history) {
    const day = h.recorded_at.slice(0, 10);
    const bucket = byDate.get(day) ?? {};
    if (!(h.metric in bucket)) bucket[h.metric] = h.value;
    byDate.set(day, bucket);
  }
  const latestDay = [...byDate.keys()].sort().reverse()[0];
  const derivedMetrics = latestDay ? computeDerivedMetrics(byDate.get(latestDay)!) : [];

  return (
    <SubPage user={user} title="Tests et mesures" subtitle="Tes mesures et les tests faits avec ton coach">
      {batches.length > 0 && (
        <Panel title="Mes tests à l'effort">
          <ul className="flex flex-col">
            {batches.slice(0, 6).map((b) => (
              <li key={b.batchId} className="flex flex-col gap-1 border-t border-paper-dim py-2.5 first:border-t-0 first:pt-0">
                <span className="flex items-baseline justify-between gap-2">
                  <b className="text-[14.5px] text-ink">{b.customLabel ?? (b.testSlug ? EFFORT_TEST_CATALOG[b.testSlug]?.label : null) ?? "Test"}</b>
                  <span className="text-xs text-slate">{new Date(`${b.testDate.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
                </span>
                <span className="text-[13px] text-slate">
                  {b.metrics
                    .map((m) => {
                      const def = PERFORMANCE_METRICS.find((p) => p.value === m.metric);
                      return `${def?.label ?? m.metric} ${String(Math.round(m.value * 10) / 10).replace(".", ",")}${def?.unit ? ` ${def.unit}` : ""}`;
                    })
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
        <Panel title="Mes mesures" hint="Touche un indicateur pour voir son évolution.">
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
        </Panel>
    </SubPage>
  );
}
