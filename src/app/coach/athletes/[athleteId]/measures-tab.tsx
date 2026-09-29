"use client";

import { useState } from "react";
import type { CustomEffortTestRow, EffortTestBatch } from "@/lib/queries";
import { EffortTestsPanel } from "./effort-tests-panel";
import { TestBubble, batchLabel, metricText } from "./effort-test-detail";
import { Panel, PanelTitle, Row, Segmented, TabHeader, Reveal, ghostBtn, linkBtn } from "./tab-ui";

export interface MetricSeries {
  key: string;
  label: string;
  unit: string;
  points: { date: string; value: number }[];
}

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function fmtVal(v: number, unit: string) {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
  return unit ? `${s} ${unit}` : s;
}

function Evolution({
  series,
  isSelected,
  canPick,
  onPick,
}: {
  series: MetricSeries[];
  isSelected: (key: string, date: string, value: number) => boolean;
  canPick: (key: string, date: string, value: number) => boolean;
  onPick: (key: string, date: string, value: number) => void;
}) {
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
  const sameMonth = new Set(pts.map((p) => p.date.slice(0, 7))).size < pts.length;
  const tick = (d: string) => (sameMonth ? `${Number(d.slice(8, 10))} ${monthOf(d).slice(0, 4).toLowerCase()}${monthOf(d).length > 4 ? "." : ""}` : monthOf(d));
  const selIdx = pts.findIndex((p) => isSelected(s.key, p.date, p.value));
  const dark = selIdx >= 0 ? selIdx : pts.length - 1;

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
          const isOn = i === dark;
          const h = max > floor ? ((p.value - floor) / (max - floor)) * 100 : 100;
          const pickable = canPick(s.key, p.date, p.value);
          return (
            <button
              type="button"
              key={p.date + i}
              disabled={!pickable}
              onClick={() => onPick(s.key, p.date, p.value)}
              title={pickable ? "Voir le détail du test" : "Mesure saisie hors test"}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-1 enabled:cursor-pointer"
            >
              <span className={`text-xs font-semibold ${isOn ? "text-ink" : "text-ink-soft"}`}>{fmtVal(p.value, s.unit)}</span>
              <span
                className={`w-full max-w-[90px] rounded-t-lg transition-[height,background-color] duration-500 ${isOn ? "bg-[#1d4a4f]" : "bg-[#9fc2c1] group-enabled:group-hover:bg-[#5d8c8f]"}`}
                style={{ height: `${Math.max(8, h * 0.8)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-4 px-2 sm:gap-8">
        {pts.map((p, i) => (
          <span key={p.date + i} className="flex-1 text-center text-xs text-ink-soft">
            {tick(p.date)}
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

export function MeasuresTab({
  latestTest,
  series,
  bodyPanel,
  zonesPanel,
  maxesList,
  records,
  maxesPanel,
  historyPanel,
  athleteId,
  batches,
  customTests,
  weight,
}: {
  athleteId: string;
  batches: EffortTestBatch[];
  customTests: CustomEffortTestRow[];
  weight?: number;
  latestTest: { label: string; date: string; items: { label: string; value: string; hint?: string }[] } | null;
  series: MetricSeries[];
  bodyPanel: React.ReactNode;
  zonesPanel: React.ReactNode;
  maxesList: React.ReactNode;
  records: { season: { label: string; value: string; hint: string }[]; all: { label: string; value: string; hint: string }[]; seasonFrom: string };
  maxesPanel: React.ReactNode;
  historyPanel: React.ReactNode;
}) {
  const [open, setOpen] = useState<"test" | "mesure" | "charges" | "historique" | null>(null);
  const [recScope, setRecScope] = useState<"saison" | "tout">("saison");
  const shownRecords = recScope === "saison" ? records.season : records.all;
  const [selId, setSelId] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  const [editing, setEditing] = useState<EffortTestBatch | null>(null);
  const toggle = (k: typeof open) => {
    setEditing(null);
    setOpen((o) => (o === k ? null : k));
  };
  const sel = batches.find((b) => b.batchId === selId) ?? batches[0] ?? null;
  const batchAt = (key: string, date: string, value: number) => {
    const sameDay = batches.filter((b) => b.testDate.slice(0, 10) === date && b.metrics.some((m) => m.metric === key));
    return sameDay.find((b) => b.metrics.some((m) => m.metric === key && Math.abs(m.value - value) < 1e-6)) ?? sameDay[0];
  };
  const shortDate = (iso: string) => {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
    return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4).toLowerCase()}${MONTHS[d.getMonth()].length > 4 ? "." : ""} ${d.getFullYear()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <TabHeader title="Mesures" />

      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <Panel>
          <PanelTitle
            title="Tests à l'effort"
            hint={sel ? `${batchLabel(sel, customTests)} · ${shortDate(sel.testDate)}` : latestTest ? `${latestTest.label} · ${latestTest.date}` : undefined}
            right={
              <button type="button" className={ghostBtn} onClick={() => toggle("test")}>
                {open === "test" ? "Fermer" : "+ Nouveau test"}
              </button>
            }
          />
          <Reveal open={open === "test"}>
            <div className="mb-5 rounded-2xl bg-paper p-4">
              {editing && <p className="mb-3 text-sm font-semibold text-ink">Modifier · {batchLabel(editing, customTests)}</p>}
              <EffortTestsPanel
                key={editing?.batchId ?? "new"}
                athleteId={athleteId}
                batches={batches}
                customTests={customTests}
                editBatch={editing}
                onDone={
                  editing
                    ? () => {
                        setEditing(null);
                        setOpen(null);
                      }
                    : undefined
                }
              />
            </div>
          </Reveal>
          {sel ? (
            <>
              <button
                type="button"
                onClick={() => setDetail((d) => !d)}
                title="Voir le détail du test"
                className={`-mx-2 grid w-[calc(100%+1rem)] grid-cols-2 gap-4 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-paper-dim sm:grid-cols-3 lg:grid-cols-5 ${detail ? "bg-paper-dim" : ""}`}
              >
                {(sel.metrics.length ? sel.metrics : []).slice(0, 5).map((m) => {
                  const t = metricText(m.metric, m.value);
                  return (
                    <div key={m.metric}>
                      <p className="text-[13px] text-ink-soft">{t.label}</p>
                      <p className="text-[20px] font-bold leading-tight tracking-tight text-ink">{t.value}</p>
                      {t.unit === "W" && weight ? <p className="text-xs text-slate">{(m.value / weight).toFixed(1).replace(".", ",")} W/kg</p> : null}
                    </div>
                  );
                })}
                {sel.metrics.length === 0 &&
                  sel.extras.slice(0, 5).map((x, i) => (
                    <div key={x.label + i}>
                      <p className="text-[13px] text-ink-soft">{x.label}</p>
                      <p className="text-[20px] font-bold leading-tight tracking-tight text-ink">
                        {x.value}
                        {x.unit ? ` ${x.unit}` : ""}
                      </p>
                    </div>
                  ))}
              </button>
              {!detail && <p className="mt-1 text-xs text-slate">Cliquez sur le test ou une barre de l’évolution pour voir le détail.</p>}
              {detail && (
                <TestBubble
                  key={sel.batchId}
                  batch={sel}
                  customTests={customTests}
                  athleteId={athleteId}
                  weight={weight}
                  onClose={() => setDetail(false)}
                  onEdit={() => {
                    setEditing(sel);
                    setDetail(false);
                    setOpen("test");
                  }}
                  onDeleted={() => {
                    setDetail(false);
                    setSelId(null);
                  }}
                />
              )}
            </>
          ) : latestTest ? (
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
          <Evolution
            series={series}
            isSelected={(k, d, v) => !!sel && batchAt(k, d, v)?.batchId === sel.batchId}
            canPick={(k, d, v) => !!batchAt(k, d, v)}
            onPick={(k, d, v) => {
              const b = batchAt(k, d, v);
              if (!b) return;
              setSelId(b.batchId);
              setDetail(true);
            }}
          />
          <button type="button" className={`${linkBtn} mt-4`} onClick={() => toggle("historique")}>
            {open === "historique" ? "Masquer les mesures enregistrées" : "Toutes les mesures enregistrées"}
          </button>
          <Reveal open={open === "historique"}>
            <div className="mt-3">{historyPanel}</div>
          </Reveal>
        </Panel>

        {bodyPanel}
      </div>

      {zonesPanel}

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
          {maxesList}
        </Panel>
        <Panel>
          <PanelTitle
            title="Records"
            right={
              <Segmented
                value={recScope}
                onChange={(v) => setRecScope(v as "saison" | "tout")}
                options={[
                  { value: "saison", label: "Cette saison" },
                  { value: "tout", label: "Tout" },
                ]}
              />
            }
          />
          <p className="-mt-2 mb-3 text-[13px] text-ink-soft">
            Relevés automatiquement dans les activités importées{recScope === "saison" ? ` depuis le ${records.seasonFrom}` : ""}
          </p>
          {shownRecords.length === 0 ? (
            <p className="text-sm text-slate">{recScope === "saison" ? "Aucune activité importée cette saison." : "Aucune activité importée pour l'instant."}</p>
          ) : (
            <div className="flex flex-col">
              {shownRecords.map((r) => (
                <Row key={r.label} label={r.label} value={r.value} hint={r.hint} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
