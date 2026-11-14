import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMeasurementsForAthlete, getLatestMeasurements, getEffortTestBatchesForAthlete } from "@/lib/queries";
import { PERFORMANCE_METRICS, METRIC_TIPS, computeDerivedMetrics } from "@/lib/performance-metrics";
import { EFFORT_TEST_CATALOG } from "@/lib/effort-tests";
import { PerformanceStats, type MeasurementPoint } from "../performance-stats";
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
  const tips = PERFORMANCE_METRICS.filter((m) => latest[m.value] && METRIC_TIPS[m.value]).map((m) => ({ label: m.label.replace(/ \(.*\)$/, ""), tip: METRIC_TIPS[m.value] }));

  return (
    <SubPage user={user} title="Tests et mesures" subtitle="Renseignés par ton coach après vos tests et l'entretien">
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
        <Panel title="Mes repères" hint="Touche un indicateur pour voir son évolution.">
          <PerformanceStats metrics={METRICS} latest={latest} seriesByMetric={seriesByMetric} />
          {tips.length > 0 && (
            <div className="mt-2 flex flex-col gap-2.5 border-t border-paper-dim pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate">À quoi ça te sert</p>
              {tips.map((t) => (
                <p key={t.label} className="text-[13px] leading-snug text-ink-soft">
                  <b className="font-semibold text-ink">{t.label}</b> · {t.tip}
                </p>
              ))}
            </div>
          )}
          {Object.keys(latest).length === 0 && <p className="text-sm text-slate">Ton coach les renseignera après vos premiers tests.</p>}
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
        </Panel>
    </SubPage>
  );
}
