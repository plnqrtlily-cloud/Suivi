"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMeasurementAction, updateMeasurementAction, deleteMeasurementAction } from "@/lib/actions";
import { BODY_METRICS, normalizeMetricName } from "@/lib/performance-metrics";
import type { AthleteMeasurement } from "@/lib/queries";
import { Panel, PanelTitle, linkBtn, primaryBtn, ghostBtn, fieldClass, fieldLabel, Reveal } from "./tab-ui";

// Carte « Mesures corporelles » : poids en tête, puis une ligne par mesure
// relevée. Un clic ouvre une bulle avec l'évolution et les valeurs, chacune
// modifiable ou supprimable (crayon). « + Mesure » propose une liste — les
// essentielles d'abord — ou une mesure nommée par le coach, comparée ensuite
// aux mesures du même nom.

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const GROUPS = ["Essentielles", "Composition", "Mensurations"];

function num(v: number) {
  return (Math.round(v * 10) / 10).toString().replace(".", ",");
}
function day(iso: string) {
  return iso.slice(0, 10);
}
function frd(iso: string) {
  const [, m, d] = day(iso).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]}`;
}
function frs(iso: string) {
  const [, m, d] = day(iso).split("-").map(Number);
  return `${d} ${MS[m - 1]}`;
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Kind {
  key: string;
  label: string;
  unit: string;
  hint?: string;
  custom?: boolean;
}

export function BodyMeasures({
  athleteId,
  history,
  power,
}: {
  athleteId: string;
  history: AthleteMeasurement[];
  /** Dernières puissances de référence (tests) pour le rapport poids / puissance. */
  power: { pma?: { value: number; date: string }; ftp?: { value: number; date: string } };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Séries par mesure, de la plus ancienne à la plus récente.
  const series = useMemo(() => {
    const map = new Map<string, AthleteMeasurement[]>();
    for (const h of history) {
      if (!map.has(h.metric)) map.set(h.metric, []);
      map.get(h.metric)!.push(h);
    }
    for (const list of map.values()) list.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    return map;
  }, [history]);

  const customKinds: Kind[] = useMemo(() => {
    const out: Kind[] = [];
    for (const [key, list] of series) {
      if (!key.startsWith("custom:")) continue;
      const withLabel = list.find((m) => m.label) ?? list[0];
      out.push({ key, label: withLabel.label || key.slice(7), unit: withLabel.unit || "", custom: true });
    }
    return out;
  }, [series]);
  const kinds: Kind[] = [...BODY_METRICS, ...customKinds];

  const weight = series.get("weight_kg") ?? [];
  const wLast = weight[weight.length - 1];
  const wFirst = weight[0];

  const run = (fn: () => Promise<unknown>, after?: () => void) =>
    start(async () => {
      try {
        setError("");
        await fn();
        after?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      }
    });

  const rows = kinds.filter((k) => k.key !== "weight_kg" && (series.get(k.key)?.length ?? 0) > 0);
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k));

  return (
    <Panel>
      <PanelTitle
        title="Mesures corporelles"
        right={
          <button type="button" className={linkBtn} onClick={() => setAdding((a) => !a)}>
            {adding ? "Fermer" : "+ Mesure"}
          </button>
        }
      />
      <Reveal open={adding}>
        {adding && (
          <AddMeasure
            kinds={kinds}
            series={series}
            pending={pending}
            error={error}
            onCancel={() => setAdding(false)}
            onSubmit={(fd) => {
              fd.set("athleteId", athleteId);
              run(() => addMeasurementAction(fd), () => setAdding(false));
            }}
          />
        )}
      </Reveal>

      {wLast ? (
        <div className="mb-2 flex items-end gap-4">
          <button
            type="button"
            onClick={() => toggle("weight_kg")}
            className={`-mx-2 -my-1 rounded-xl px-2 py-1 text-left transition-colors ${open === "weight_kg" ? "bg-paper-dim" : "hover:bg-paper"}`}
            title="Voir l’évolution du poids"
          >
            <p className="text-[13px] text-ink-soft">Poids</p>
            <p className="text-[26px] font-bold leading-tight tracking-tight text-ink">{num(wLast.value)} kg</p>
            {weight.length > 1 && (
              <p className="text-xs text-slate">
                {wLast.value - wFirst.value > 0 ? "+" : wLast.value - wFirst.value < 0 ? "−" : "±"}
                {num(Math.abs(wLast.value - wFirst.value))} kg depuis le {frd(wFirst.recorded_at)}
              </p>
            )}
          </button>
          {weight.length > 1 && <Sparkline points={weight.map((p) => p.value)} />}
        </div>
      ) : null}
      {open === "weight_kg" && wLast && (
        <Bubble kind={kinds[0]} list={weight} pending={pending} athleteId={athleteId} onClose={() => setOpen(null)} run={run} />
      )}

      <div className="flex flex-col">
        {rows.map((k) => {
          const list = series.get(k.key)!;
          const l = list[list.length - 1];
          const p = list[list.length - 2];
          const dd = p ? Math.round((l.value - p.value) * 10) / 10 : null;
          const delta = dd === null ? "" : dd === 0 ? " · stable" : ` · ${dd > 0 ? "+" : "−"}${num(Math.abs(dd))}${k.unit === "%" ? " pt" : k.unit ? ` ${k.unit}` : ""}`;
          return (
            <div key={k.key} className="flex flex-col">
              <button
                type="button"
                onClick={() => toggle(k.key)}
                className={`flex items-baseline gap-2 border-t border-line/70 py-2 text-left text-sm transition-colors ${open === k.key ? "bg-paper-dim" : "hover:bg-paper"}`}
              >
                <span className="text-ink-soft">{k.label}</span>
                <span className="flex-1" />
                <b className="text-ink">
                  {num(l.value)}
                  {k.unit ? ` ${k.unit}` : ""}
                </b>
                <span className="text-xs text-slate">
                  {frs(l.recorded_at)}
                  {delta}
                </span>
              </button>
              {open === k.key && <Bubble kind={k} list={list} pending={pending} athleteId={athleteId} onClose={() => setOpen(null)} run={run} />}
            </div>
          );
        })}
        {wLast && power.pma && (
          <div className="flex items-baseline gap-2 border-t border-line/70 py-2 text-sm">
            <span className="text-ink-soft">Rapport poids / puissance</span>
            <span className="flex-1" />
            <b className="text-ink">{num(power.pma.value / wLast.value)} W/kg</b>
            <span className="text-xs text-slate">PMA {Math.round(power.pma.value)} W · {frs(power.pma.date)}</span>
          </div>
        )}
        {wLast && power.ftp && (
          <div className="flex items-baseline gap-2 border-t border-line/70 py-2 text-sm">
            <span className="text-ink-soft">FTP / poids</span>
            <span className="flex-1" />
            <b className="text-ink">{num(power.ftp.value / wLast.value)} W/kg</b>
            <span className="text-xs text-slate">FTP {Math.round(power.ftp.value)} W · {frs(power.ftp.date)}</span>
          </div>
        )}
      </div>
      {!wLast && rows.length === 0 && <p className="text-sm text-slate">Aucune mesure renseignée.</p>}
    </Panel>
  );
}

function AddMeasure({
  kinds,
  series,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  kinds: Kind[];
  series: Map<string, AthleteMeasurement[]>;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const isOther = key === "custom";
  const kind = kinds.find((k) => k.key === key);
  // « Autre » : si le nom correspond à une mesure existante, on la reprend.
  const match = isOther && name.trim() ? kinds.find((k) => normalizeMetricName(k.label) === normalizeMetricName(name)) : undefined;
  const target = kind ?? match;
  const list = target ? series.get(target.key) ?? [] : [];
  const prev = list[list.length - 1];
  const shownUnit = target ? target.unit : unit;
  const ro = "flex min-h-[38px] items-center rounded-[10px] border border-line/70 bg-paper-dim px-3 text-sm text-ink-soft";

  return (
    <form
      className="mb-4 flex flex-col gap-3 rounded-2xl bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (isOther) {
          fd.set("metric", "custom");
          fd.set("customName", name);
          fd.set("customUnit", unit);
        } else fd.set("metric", key);
        onSubmit(fd);
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Mesure</span>
        <select value={key} onChange={(e) => setKey(e.target.value)} className={fieldClass} required>
          <option value="">Choisir une mesure…</option>
          {GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {kinds
                .filter((k) => !k.custom && BODY_METRICS.find((b) => b.key === k.key)?.group === g)
                .map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label} ({k.unit})
                  </option>
                ))}
            </optgroup>
          ))}
          {kinds.some((k) => k.custom) && (
            <optgroup label="Mes mesures">
              {kinds
                .filter((k) => k.custom)
                .map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                    {k.unit ? ` (${k.unit})` : ""}
                  </option>
                ))}
            </optgroup>
          )}
          <option value="custom">Autre… (à nommer)</option>
        </select>
      </label>
      {key && (
        <div className="flex flex-col gap-3 border-t border-line pt-3 animate-expand-in">
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Nom</span>
              {isOther ? (
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Gainage planche" className={fieldClass} required />
              ) : (
                <span className={ro}>{kind?.label}</span>
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Date</span>
              <input type="date" name="recordedAt" defaultValue={today()} className={fieldClass} required />
            </label>
          </div>
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Valeur</span>
              <input name="value" type="number" step="any" required className={fieldClass} autoFocus={!isOther} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Unité</span>
              {isOther && !match ? (
                <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="s, cm, kg…" className={fieldClass} />
              ) : (
                <span className={ro}>{shownUnit || "—"}</span>
              )}
            </label>
          </div>
          <p className="text-xs text-slate">
            {isOther && !name.trim()
              ? "Si une mesure porte déjà ce nom, la nouvelle valeur lui sera comparée."
              : [
                  target?.hint,
                  prev
                    ? `${isOther && match ? `Comparée à « ${match.label} » · ` : ""}dernière valeur : ${num(prev.value)}${shownUnit ? ` ${shownUnit}` : ""} le ${frd(prev.recorded_at)}`
                    : "Première mesure de ce type",
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className={primaryBtn}>
              Enregistrer
            </button>
            <button type="button" onClick={onCancel} className={ghostBtn}>
              Annuler
            </button>
            {error && <span className="text-sm text-clay">{error}</span>}
          </div>
        </div>
      )}
    </form>
  );
}

function Bubble({
  kind,
  list,
  athleteId,
  pending,
  onClose,
  run,
}: {
  kind: Kind;
  list: AthleteMeasurement[];
  athleteId: string;
  pending: boolean;
  onClose: () => void;
  run: (fn: () => Promise<unknown>, after?: () => void) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [draft, setDraft] = useState({ d: "", v: "" });
  const u = kind.unit ? ` ${kind.unit}` : "";
  const first = list[0];
  const last = list[list.length - 1];
  const dd = Math.round((last.value - first.value) * 10) / 10;
  const pts = list.slice(-20);
  const mx = Math.max(...pts.map((p) => p.value));
  const mn = Math.min(...pts.map((p) => p.value));
  const t0 = new Date(day(pts[0].recorded_at)).getTime();
  const t1 = new Date(day(pts[pts.length - 1].recorded_at)).getTime();
  const px = (p: AthleteMeasurement, i: number) =>
    t1 === t0 ? (pts.length === 1 ? 50 : (i / (pts.length - 1)) * 100) : ((new Date(day(p.recorded_at)).getTime() - t0) / (t1 - t0)) * 100;
  const py = (p: AthleteMeasurement) => (mx === mn ? 50 : 8 + ((mx - p.value) / (mx - mn)) * 84);
  const many = pts.length > 8;

  return (
    <div className="relative mb-2 mt-2 animate-expand-in">
      <span className="absolute -top-[7px] left-6 h-3.5 w-3.5 rotate-45 border-l border-t border-line bg-paper" />
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3.5">
        <div className="flex items-center gap-2">
          <b className="text-[14.5px] text-ink">{kind.label}</b>
          <span className="text-xs text-slate">
            {list.length} mesure{list.length > 1 ? "s" : ""}
            {list.length > 1 && ` · ${dd > 0 ? "+" : dd < 0 ? "−" : "±"}${num(Math.abs(dd))}${kind.unit === "%" ? " pt" : u} depuis le ${frd(first.recorded_at)}`}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-slate">
            ×
          </button>
        </div>
        {pts.length > 1 && (
          <div>
            <div className="relative mx-1.5 mt-4 h-24">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                <polyline
                  points={pts.map((p, i) => `${(px(p, i) * 3).toFixed(1)},${py(p).toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke="#1d4a4f"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {pts.map((p, i) => {
                const isLast = i === pts.length - 1;
                const label = !many || isLast || i === 0 || p.value === mx || p.value === mn;
                return (
                  <span key={p.id} className="absolute" style={{ left: `${px(p, i)}%`, top: `${py(p) * 0.96}px` }} title={`${frs(p.recorded_at)} · ${num(p.value)}${u}`}>
                    <span
                      className="absolute block rounded-full border-2 border-paper"
                      style={{ width: isLast ? 10 : 8, height: isLast ? 10 : 8, left: isLast ? -5 : -4, top: isLast ? -5 : -4, background: isLast ? "#1d4a4f" : "#5d8c8f" }}
                    />
                    {label && <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[11.5px] font-bold text-ink">{num(p.value)}</span>}
                  </span>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[11.5px] text-slate">
              <span>{frs(pts[0].recorded_at)}</span>
              <span>{frs(pts[pts.length - 1].recorded_at)}</span>
            </div>
          </div>
        )}
        <div className="flex flex-col">
          {[...list].reverse().map((m) => (
            <div key={m.id} className="flex min-h-[36px] items-center gap-2.5 border-t border-line/70 py-1.5 text-[13.5px]">
              {editing === m.id ? (
                <>
                  <input type="date" value={draft.d} onChange={(e) => setDraft({ ...draft, d: e.target.value })} className="w-[128px] rounded-lg border border-line bg-white px-2 py-1 text-[13.5px]" />
                  <input type="number" step="any" value={draft.v} onChange={(e) => setDraft({ ...draft, v: e.target.value })} className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-[13.5px]" />
                  <span className="text-slate">{kind.unit}</span>
                  <span className="flex-1" />
                  <button type="button" onClick={() => { setEditing(null); setConfirm(m.id); }} className="text-[12.5px] font-semibold text-clay">
                    Supprimer
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("metric", m.metric);
                      fd.set("value", draft.v.replace(",", "."));
                      fd.set("recordedAt", draft.d);
                      fd.set("note", m.note ?? "");
                      fd.set("device", m.device ?? "");
                      run(() => updateMeasurementAction(m.id, athleteId, fd), () => setEditing(null));
                    }}
                    className="rounded-full bg-moss px-3 py-1 text-[12.5px] font-semibold text-white disabled:opacity-50"
                  >
                    OK
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="text-[12.5px] font-semibold text-slate">
                    Annuler
                  </button>
                </>
              ) : confirm === m.id ? (
                <>
                  <span className="text-ink-soft">Supprimer la mesure du {frd(m.recorded_at)} ?</span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteMeasurementAction(m.id, athleteId), () => setConfirm(null))}
                    className="rounded-full bg-clay px-3 py-1 text-[12.5px] font-semibold text-white disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                  <button type="button" onClick={() => setConfirm(null)} className="text-[12.5px] font-semibold text-slate">
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <span className="w-28 text-slate">{frd(m.recorded_at)}</span>
                  <b className="text-ink">
                    {num(m.value)}
                    {u}
                  </b>
                  <span className="flex-1" />
                  <button
                    type="button"
                    aria-label="Modifier ou supprimer"
                    title="Modifier ou supprimer"
                    onClick={() => {
                      setConfirm(null);
                      setEditing(m.id);
                      setDraft({ d: day(m.recorded_at), v: String(m.value) });
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-slate hover:bg-white hover:text-ink"
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13.5 3.5l3 3L7 16H4v-3z" />
                      <path d="M11.5 5.5l3 3" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const pts = points.map((v, i) => `${(i / (points.length - 1)) * 100},${max === min ? 20 : 36 - ((v - min) / (max - min)) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mb-3 h-10 flex-1">
      <polyline points={pts} fill="none" stroke="#1d4a4f" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
