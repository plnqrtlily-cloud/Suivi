"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEffortTestBatchAction } from "@/lib/actions";
import { EFFORT_TEST_CATALOG, ergometerLabel, parseCustomFields } from "@/lib/effort-tests";
import { PERFORMANCE_METRICS } from "@/lib/performance-metrics";
import type { CustomEffortTestRow, EffortTestBatch } from "@/lib/queries";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function frDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function num(v: number) {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace(".", ",");
}

export function batchLabel(b: EffortTestBatch, customTests: CustomEffortTestRow[]) {
  if (b.testSlug) return EFFORT_TEST_CATALOG[b.testSlug]?.label ?? b.testSlug;
  if (b.customTestId) return customTests.find((t) => t.id === b.customTestId)?.name ?? b.customLabel ?? "Test personnalisé";
  return b.customLabel ?? "Test";
}

export function metricText(metric: string, value: number) {
  const def = PERFORMANCE_METRICS.find((m) => m.value === metric);
  return { label: def?.label ?? metric, value: `${num(value)}${def?.unit ? ` ${def.unit}` : ""}`, unit: def?.unit };
}

/** Bulle de détail d'un test à l'effort : toutes les données saisies, avec Modifier / Supprimer. */
export function TestBubble({
  batch,
  customTests,
  athleteId,
  weight,
  onClose,
  onEdit,
  onDeleted,
}: {
  batch: EffortTestBatch;
  customTests: CustomEffortTestRow[];
  athleteId: string;
  weight?: number;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const def = batch.testSlug ? EFFORT_TEST_CATALOG[batch.testSlug] : null;
  const custom = batch.customTestId ? customTests.find((t) => t.id === batch.customTestId) : null;
  const fieldDefs = def?.fields ?? (custom ? parseCustomFields(custom.fields_json) : []);
  // Les champs déjà répliqués comme indicateur (ex. VO2max mesurée) figurent dans « Résultats ».
  const data = Object.entries(batch.data)
    .map(([k, v]) => ({ f: fieldDefs.find((x) => x.key === k), k, v }))
    .filter(({ f }) => !(f && "metric" in f && f.metric && batch.metrics.some((m) => m.metric === f.metric)))
    .map(({ f, k, v }) => ({ label: f?.label ?? k, value: `${num(v)}${f?.unit ? ` ${f.unit}` : ""}` }));
  const results = batch.metrics.map((m) => {
    const f = fieldDefs.find((x) => "metric" in x && x.metric === m.metric);
    const t = metricText(m.metric, m.value);
    if (!t.unit && f?.unit) Object.assign(t, { value: `${num(m.value)} ${f.unit}`, unit: f.unit });
    return { ...t, hint: t.unit === "W" && weight ? `${(m.value / weight).toFixed(1).replace(".", ",")} W/kg` : undefined };
  });
  const ergo = ergometerLabel(batch.device);

  function remove() {
    setError("");
    start(async () => {
      const r = await deleteEffortTestBatchAction(batch.batchId, athleteId);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onDeleted();
      router.refresh();
    });
  }

  const section = "text-[12px] font-semibold uppercase tracking-wide text-slate";
  const line = "flex items-baseline justify-between gap-3 border-t border-line/70 py-1.5 text-[13.5px] first:border-t-0";

  return (
    <div className="relative mb-1 mt-3 animate-expand-in">
      <span className="absolute -top-[7px] left-8 h-3.5 w-3.5 rotate-45 border-l border-t border-line bg-paper" />
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
        <div className="flex items-start gap-2">
          <div className="flex flex-col">
            <b className="text-[15px] text-ink">{batchLabel(batch, customTests)}</b>
            <span className="text-xs text-slate">
              {frDate(batch.testDate)}
              {ergo && ` · ${ergo}`}
            </span>
          </div>
          <span className="flex-1" />
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-slate">
            ×
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {results.length > 0 && (
            <div>
              <p className={section}>Résultats</p>
              <div className="mt-1 flex flex-col">
                {results.map((r) => (
                  <div key={r.label} className={line}>
                    <span className="text-ink-soft">{r.label}</span>
                    <span className="text-right">
                      <b className="text-ink">{r.value}</b>
                      {r.hint && <span className="ml-2 text-xs text-slate">{r.hint}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.length > 0 && (
            <div>
              <p className={section}>Données saisies</p>
              <div className="mt-1 flex flex-col">
                {data.map((d) => (
                  <div key={d.label} className={line}>
                    <span className="text-ink-soft">{d.label}</span>
                    <b className="text-ink">{d.value}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
          {batch.extras.length > 0 && (
            <div>
              <p className={section}>{def || custom ? "Résultats complémentaires" : "Données du test"}</p>
              <div className="mt-1 flex flex-col">
                {batch.extras.map((x, i) => (
                  <div key={x.label + i} className={line}>
                    <span className="text-ink-soft">{x.label}</span>
                    <b className="text-ink">
                      {x.value}
                      {x.unit ? ` ${x.unit}` : ""}
                    </b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {batch.protocol && (
          <div>
            <p className={section}>Protocole</p>
            <p className="mt-1 whitespace-pre-line text-[13.5px] text-ink">{batch.protocol}</p>
          </div>
        )}
        {batch.note && (
          <div>
            <p className={section}>Note</p>
            <p className="mt-1 text-[13.5px] text-ink">{batch.note}</p>
          </div>
        )}
        {batch.attachmentPath && (
          <a
            href={`/api/effort-test-results/${batch.ids[0]}/attachment`}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-[13px] font-semibold text-moss-dark hover:underline"
          >
            📎 {batch.attachmentName ?? "Pièce jointe"}
          </a>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {confirm ? (
            <>
              <span className="text-[13.5px] text-ink-soft">Supprimer ce test et ses résultats ?</span>
              <button type="button" onClick={remove} disabled={pending} className="rounded-full bg-clay px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">
                {pending ? "…" : "Supprimer"}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="text-[13px] font-semibold text-slate hover:text-ink">
                Annuler
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onEdit} className="rounded-full bg-moss px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-moss-dark">
                Modifier
              </button>
              <button type="button" onClick={() => setConfirm(true)} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-semibold text-clay">
                Supprimer
              </button>
            </>
          )}
          {error && <span className="text-sm text-clay">{error}</span>}
        </div>
      </div>
    </div>
  );
}
