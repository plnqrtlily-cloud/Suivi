"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMeasurementAction } from "@/lib/actions";
import { Panel, PanelTitle, Row, Segmented, TabHeader, Reveal, ghostBtn, linkBtn, primaryBtn, fieldClass, fieldLabel } from "./tab-ui";

export interface MetricSeries {
  key: string;
  label: string;
  unit: string;
  points: { date: string; value: number }[];
}

export interface ZoneColumn {
  title: string;
  rows: { zone: number; label: string; range: string }[];
}

const ZONE_COLORS = ["#c5dcda", "#9fc2c1", "#5d8c8f", "#1d4a4f", "#e8896a"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function fmtVal(v: number, unit: string) {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
  return unit ? `${s} ${unit}` : s;
}

function Evolution({ series }: { series: MetricSeries[] }) {
  const [key, setKey] = useState(series[0]?.key ?? "");
  const s = series.find((x) => x.key === key) ?? series[0];
  if (!s) return null;
  const pts = s.points.slice(-6);
  const max = Math.max(...pts.map((p) => p.value));
  const min = Math.min(...pts.map((p) => p.value));
  const floor = Math.max(0, min - (max - min || max * 0.2) * 1.2);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const delta = last.value - first.value;
  const monthOf = (d: string) => MONTHS[Number(d.slice(5, 7)) - 1];

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-semibold text-ink">Évolution</p>
        {series.length > 1 && (
          <Segmented value={s.key} onChange={setKey} options={series.slice(0, 4).map((x) => ({ value: x.key, label: x.label }))} />
        )}
      </div>
      <div className="flex h-40 items-end gap-4 border-b border-line px-2 sm:gap-8">
        {pts.map((p, i) => {
          const isLast = i === pts.length - 1;
          const h = max > floor ? ((p.value - floor) / (max - floor)) * 100 : 100;
          return (
            <div key={p.date + i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-semibold text-ink">{fmtVal(p.value, s.unit)}</span>
              <span
                className={`w-full max-w-[90px] rounded-t-lg transition-[height] duration-500 ${isLast ? "bg-[#1d4a4f]" : "bg-[#9fc2c1]"}`}
                style={{ height: `${Math.max(8, h * 0.8)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-4 px-2 sm:gap-8">
        {pts.map((p, i) => (
          <span key={p.date + i} className="flex-1 text-center text-xs text-ink-soft">
            {monthOf(p.date)}
          </span>
        ))}
      </div>
      {pts.length > 1 && (
        <p className="mt-3 text-[13px] text-ink-soft">
          {s.label} : {delta >= 0 ? "+" : "−"}
          {fmtVal(Math.abs(Math.round(delta * 10) / 10), s.unit)} depuis {monthOf(first.date).toLowerCase()}
          {pts.every((p, i) => i === 0 || p.value >= pts[i - 1].value) && delta > 0 ? ", en progression à chaque test." : "."}
        </p>
      )}
    </div>
  );
}

function MeasureForm({ athleteId, metrics, onDone }: { athleteId: string; metrics: { value: string; label: string; group: string }[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const groups = Array.from(new Set(metrics.map((m) => m.group)));
  return (
    <form
      className="mb-4 grid grid-cols-2 gap-3 rounded-2xl bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        fd.set("athleteId", athleteId);
        start(async () => {
          await addMeasurementAction(fd);
          form.reset();
          onDone();
          router.refresh();
        });
      }}
    >
      <div className="col-span-2">
        <label className={fieldLabel}>Indicateur</label>
        <select name="metric" required defaultValue="weight_kg" className={fieldClass}>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {metrics
                .filter((m) => m.group === g)
                .map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className={fieldLabel}>Valeur</label>
        <input type="number" step="0.1" name="value" required className={fieldClass} />
      </div>
      <div>
        <label className={fieldLabel}>Date</label>
        <input type="date" name="recordedAt" defaultValue={new Date().toISOString().slice(0, 10)} className={fieldClass} />
      </div>
      <div className="col-span-2">
        <button type="submit" disabled={pending} className={primaryBtn}>
          Ajouter
        </button>
      </div>
    </form>
  );
}

export function MeasuresTab({
  athleteId,
  latestTest,
  series,
  body,
  weightSeries,
  zones,
  zonesHint,
  maxes,
  records,
  metrics,
  effortPanel,
  maxesPanel,
  historyPanel,
}: {
  athleteId: string;
  latestTest: { label: string; date: string; items: { label: string; value: string; hint?: string }[] } | null;
  series: MetricSeries[];
  body: { label: string; value: string; hint?: string }[];
  weightSeries: { date: string; value: number }[];
  zones: ZoneColumn[];
  zonesHint: string;
  maxes: { name: string; value: string; hint: string }[];
  records: { label: string; value: string; hint: string }[];
  metrics: { value: string; label: string; group: string }[];
  effortPanel: React.ReactNode;
  maxesPanel: React.ReactNode;
  historyPanel: React.ReactNode;
}) {
  const [open, setOpen] = useState<"test" | "mesure" | "charges" | "historique" | null>(null);
  const toggle = (k: typeof open) => setOpen((o) => (o === k ? null : k));
  const w = weightSeries;
  const wLast = w[w.length - 1];
  const wFirst = w[0];

  return (
    <div className="flex flex-col gap-6">
      <TabHeader title="Mesures" subtitle="Tests, zones, charges de référence et records" />

      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <Panel>
          <PanelTitle
            title="Tests à l'effort"
            hint={latestTest ? `${latestTest.label} · ${latestTest.date}` : undefined}
            right={
              <button type="button" className={ghostBtn} onClick={() => toggle("test")}>
                {open === "test" ? "Fermer" : "+ Nouveau test"}
              </button>
            }
          />
          <Reveal open={open === "test"}>
            <div className="mb-5 rounded-2xl bg-paper p-4">{effortPanel}</div>
          </Reveal>
          {latestTest ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {latestTest.items.map((t) => (
                <div key={t.label}>
                  <p className="text-[13px] text-ink-soft">{t.label}</p>
                  <p className="text-[20px] font-bold leading-tight tracking-tight text-ink">{t.value}</p>
                  {t.hint && <p className="text-xs text-slate">{t.hint}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate">Aucun test pour l&apos;instant.</p>
          )}
          <Evolution series={series} />
        </Panel>

        <Panel>
          <PanelTitle
            title="Mesures corporelles"
            right={
              <button type="button" className={linkBtn} onClick={() => toggle("mesure")}>
                {open === "mesure" ? "Fermer" : "+ Mesure"}
              </button>
            }
          />
          <Reveal open={open === "mesure"}>
            <MeasureForm athleteId={athleteId} metrics={metrics} onDone={() => setOpen(null)} />
          </Reveal>
          {wLast && (
            <div className="mb-3 flex items-end gap-4">
              <div>
                <p className="text-[13px] text-ink-soft">Poids</p>
                <p className="text-[26px] font-bold leading-tight tracking-tight text-ink">{fmtVal(wLast.value, "kg")}</p>
                {w.length > 1 && (
                  <p className="text-xs text-slate">
                    {wLast.value - wFirst.value >= 0 ? "+" : "−"}
                    {fmtVal(Math.abs(Math.round((wLast.value - wFirst.value) * 10) / 10), "kg")} depuis {MONTHS[Number(wFirst.date.slice(5, 7)) - 1].toLowerCase()}
                  </p>
                )}
              </div>
              {w.length > 1 && <Sparkline points={w.map((p) => p.value)} />}
            </div>
          )}
          <div className="flex flex-col">
            {body.map((b) => (
              <Row key={b.label} label={b.label} value={b.value} hint={b.hint} />
            ))}
          </div>
          {!wLast && body.length === 0 && <p className="text-sm text-slate">Aucune mesure renseignée.</p>}
          <button type="button" className={`${linkBtn} mt-3`} onClick={() => toggle("historique")}>
            {open === "historique" ? "Masquer l'historique" : "Historique des mesures"}
          </button>
          <Reveal open={open === "historique"}>
            <div className="mt-3">{historyPanel}</div>
          </Reveal>
        </Panel>
      </div>

      {zones.length > 0 && (
        <Panel>
          <PanelTitle title="Zones d'entraînement" hint={zonesHint} />
          <div className="grid gap-8 md:grid-cols-3">
            {zones.map((col) => (
              <div key={col.title}>
                <p className="mb-2 text-sm font-semibold text-ink">{col.title}</p>
                <ul className="flex flex-col">
                  {col.rows.map((r) => (
                    <li key={r.zone} className="grid grid-cols-[6px_28px_1fr_auto] items-center gap-2.5 py-2 text-sm">
                      <span className="h-5 rounded-sm" style={{ background: ZONE_COLORS[r.zone - 1] ?? "#c5dcda" }} />
                      <b className="font-semibold text-ink">Z{r.zone}</b>
                      <span className="text-ink-soft">{r.label}</span>
                      <b className="font-semibold text-ink">{r.range}</b>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelTitle
            title="Charges de référence"
            right={
              <button type="button" className={linkBtn} onClick={() => toggle("charges")}>
                {open === "charges" ? "Fermer" : "+ Exercice"}
              </button>
            }
          />
          <p className="-mt-2 mb-3 text-[13px] text-ink-soft">Servent à convertir les charges en % dans les séances de muscu</p>
          <Reveal open={open === "charges"}>
            <div className="mb-4 rounded-2xl bg-paper p-4">{maxesPanel}</div>
          </Reveal>
          {maxes.length === 0 ? (
            <p className="text-sm text-slate">Aucune charge renseignée.</p>
          ) : (
            <div className="flex flex-col">
              {maxes.map((m) => (
                <Row key={m.name} label={m.name} value={m.value} hint={m.hint} />
              ))}
            </div>
          )}
        </Panel>
        <Panel>
          <PanelTitle title="Records" />
          <p className="-mt-2 mb-3 text-[13px] text-ink-soft">Relevés automatiquement dans les activités importées</p>
          {records.length === 0 ? (
            <p className="text-sm text-slate">Aucune activité importée pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-col">
              {records.map((r) => (
                <Row key={r.label} label={r.label} value={r.value} hint={r.hint} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const pts = points
    .map((v, i) => `${(i / (points.length - 1)) * 100},${max === min ? 20 : 36 - ((v - min) / (max - min)) * 32}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mb-3 h-10 flex-1">
      <polyline points={pts} fill="none" stroke="#1d4a4f" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
