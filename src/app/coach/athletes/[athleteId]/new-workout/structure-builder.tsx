"use client";

import type { ActivityDef, TargetKind, UnitKind } from "@/lib/discipline";

// Structure d'une séance d'endurance : des blocs (échauffement, corps de
// séance…), contenant des étapes et des répétitions d'étapes. Même format
// JSON qu'avant (kind step / repeat) avec un niveau « bloc » en plus ; les
// séances existantes sans bloc sont rangées automatiquement à l'ouverture.

export type StepType = "warmup" | "work" | "recovery" | "rest" | "cooldown";

export interface StepItem {
  id: string;
  kind: "step";
  stepType: StepType;
  durationType: "time" | "distance" | "manual";
  durationValue: string;
  target: { type: TargetKind; zone?: number; freeText?: string };
  stroke?: string;
  /** Saisie telle que tapée et unité affichée (km ou m) : confort d'édition. */
  raw?: string;
  unit?: UnitKind;
}
export interface RepeatItem {
  id: string;
  kind: "repeat";
  count: number;
  steps: StepItem[];
}
export interface BlocItem {
  id: string;
  kind: "bloc";
  title: string;
  items: (StepItem | RepeatItem)[];
}
export type StructureItem = StepItem | RepeatItem | BlocItem;

export interface ZoneLabels {
  hr_zone?: string[];
  power_zone?: string[];
  pace_zone?: string[];
}

export const BLOC_TITLES = ["Échauffement", "Corps de séance", "Technique / éducatifs", "Retour au calme"];
const STEP_LABEL: Record<StepType, string> = { warmup: "Échauffement", work: "Effort", recovery: "Récupération", rest: "Repos", cooldown: "Retour au calme" };
const STEP_COLOR: Record<StepType, string> = { warmup: "#9fc3c4", work: "#1b4b4f", recovery: "#c9dcdc", rest: "#e6eae9", cooldown: "#9fc3c4" };
const ZONE_COLOR = ["#dde3e2", "#c9dcdc", "#9fc3c4", "#5b8a8c", "#1b4b4f", "#e8896a"];
const TARGET_LABEL: Record<TargetKind, string> = { pace_zone: "Zone d'allure", hr_zone: "Zone de FC", power_zone: "Zone de puissance", free: "Cible libre", none: "Aucune cible" };
const UNIT_LABEL: Record<UnitKind, string> = { min: "temps", km: "km", m: "m", libre: "libre" };
const STROKES = ["Crawl", "Dos", "Brasse", "Papillon", "4 nages", "Éducatifs", "Jambes", "Bras (pull)"];

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
const isZone = (t: TargetKind) => t === "hr_zone" || t === "pace_zone" || t === "power_zone";

export function newStep(type: StepType, act: ActivityDef): StepItem {
  const unit: UnitKind = act.units[0] === "m" && type !== "recovery" && type !== "rest" ? "m" : "min";
  const target: TargetKind = type === "recovery" || type === "rest" ? "none" : act.targets[0];
  return {
    id: uid(),
    kind: "step",
    stepType: type,
    durationType: unit === "m" ? "distance" : "time",
    durationValue: "",
    target: isZone(target) ? { type: target, zone: type === "work" ? 3 : type === "warmup" ? 2 : 1 } : { type: target },
    unit,
    raw: "",
  };
}

export function defaultStructure(act: ActivityDef): BlocItem[] {
  return [
    { id: uid(), kind: "bloc", title: "Échauffement", items: [newStep("warmup", act)] },
    { id: uid(), kind: "bloc", title: "Corps de séance", items: [newStep("work", act)] },
    { id: uid(), kind: "bloc", title: "Retour au calme", items: [newStep("cooldown", act)] },
  ];
}

/** Range une structure sans bloc (séances existantes) en échauffement / corps / retour au calme. */
export function toBlocs(items: StructureItem[]): BlocItem[] {
  if (!items.length) return [];
  if (items.every((i) => i.kind === "bloc")) return items as BlocItem[];
  const flat = items.filter((i) => i.kind !== "bloc") as (StepItem | RepeatItem)[];
  let a = 0;
  while (a < flat.length && flat[a].kind === "step" && (flat[a] as StepItem).stepType === "warmup") a++;
  let b = flat.length;
  while (b > a && flat[b - 1].kind === "step" && (flat[b - 1] as StepItem).stepType === "cooldown") b--;
  const out: BlocItem[] = [];
  if (a > 0) out.push({ id: uid(), kind: "bloc", title: "Échauffement", items: flat.slice(0, a) });
  if (b > a) out.push({ id: uid(), kind: "bloc", title: "Corps de séance", items: flat.slice(a, b) });
  if (flat.length > b) out.push({ id: uid(), kind: "bloc", title: "Retour au calme", items: flat.slice(b) });
  return out;
}

/** Adapte une structure à une autre activité : cibles et unités non proposées
 * par la nouvelle discipline sont remplacées (valeur vidée si l'unité change). */
export function adaptStructure(items: BlocItem[], act: ActivityDef): BlocItem[] {
  const fix = (st: StepItem): StepItem => {
    const s = { ...st, target: { ...st.target } };
    if (!act.targets.includes(s.target.type)) {
      const t = s.stepType === "recovery" || s.stepType === "rest" ? (act.targets.includes("none") ? "none" : act.targets[0]) : act.targets[0];
      s.target = isZone(t) ? { type: t, zone: s.target.zone ?? (s.stepType === "work" ? 3 : 2) } : { type: t, freeText: s.target.freeText };
    }
    const u = s.durationType === "manual" ? "libre" : s.durationType === "time" ? "min" : s.unit === "km" ? "km" : "m";
    if (!act.units.includes(u)) {
      const nu: UnitKind = act.units.includes("min") ? "min" : act.units[0];
      Object.assign(s, { durationType: nu === "min" ? "time" : nu === "libre" ? "manual" : "distance", durationValue: "", raw: "", unit: nu });
    }
    if (!act.swim) delete s.stroke;
    return s;
  };
  return items.map((b) => ({ ...b, items: b.items.map((it) => (it.kind === "repeat" ? { ...it, steps: it.steps.map(fix) } : fix(it))) }));
}

// --- Durées : saisie libre ↔ format stocké ---------------------------------

function timeToMin(v: string): number {
  const m = v.match(/^(\d+):(\d{1,2})$/);
  return m ? Number(m[1]) + Number(m[2]) / 60 : 0;
}
function displayValue(s: StepItem): string {
  if (s.raw != null && s.raw !== "") return s.raw;
  if (!s.durationValue) return "";
  if (s.durationType === "time") {
    const [mm, ss] = s.durationValue.split(":").map(Number);
    if (!mm) return `${ss} s`;
    return ss ? `${mm}:${String(ss).padStart(2, "0")}` : String(mm);
  }
  if (s.durationType === "distance") {
    const n = Number(s.durationValue);
    return (s.unit ?? "m") === "km" ? String(n / 1000).replace(".", ",") : String(n);
  }
  return "";
}
function unitOf(s: StepItem): UnitKind {
  if (s.durationType === "manual") return "libre";
  if (s.durationType === "time") return "min";
  return s.unit === "km" || s.unit === "m" ? s.unit : Number(s.durationValue) >= 1000 ? "km" : "m";
}

function stepMinutes(s: StepItem, act: ActivityDef): number {
  if (s.durationType === "manual") return 5;
  if (s.durationType === "time") return timeToMin(s.durationValue);
  const km = Number(s.durationValue) / 1000;
  return Number.isNaN(km) ? 0 : km * act.minPerKm;
}

function flatten(items: StructureItem[]): StepItem[] {
  const out: StepItem[] = [];
  for (const it of items) {
    if (it.kind === "bloc") out.push(...flatten(it.items));
    else if (it.kind === "repeat") for (let i = 0; i < Math.min(it.count || 1, 40); i++) out.push(...it.steps);
    else out.push(it);
  }
  return out;
}

export function structureStats(items: StructureItem[], act: ActivityDef) {
  const f = flatten(items);
  let minutes = 0, meters = 0, hard = 0;
  for (const s of f) {
    const m = stepMinutes(s, act);
    minutes += m;
    if (s.durationType === "distance") meters += Number(s.durationValue) || 0;
    if (isZone(s.target.type) && (s.target.zone ?? 0) >= 3 && s.stepType !== "recovery" && s.stepType !== "rest") hard += m;
  }
  return { minutes: Math.round(minutes), meters, hard: Math.round(hard), flat: f };
}

function fmtMin(m: number): string {
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

// --- Saisie d'une durée : minutes et secondes séparées ------------------------

function TimeFields({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const m = value.match(/^(\d+):(\d{1,2})$/);
  const [mm, ss] = m ? [Number(m[1]), Number(m[2])] : [0, 0];
  const emit = (a: number, b: number) => {
    const total = Math.max(0, a) * 60 + Math.max(0, b);
    onChange(total ? `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` : "");
  };
  const num = (v: string) => (v === "" ? 0 : Math.floor(Number(v) || 0));
  return (
    <span className="inline-flex items-center gap-1">
      <input
        aria-label="Minutes"
        type="number"
        inputMode="numeric"
        min={0}
        value={m && mm ? mm : ""}
        placeholder="0"
        onChange={(e) => emit(num(e.target.value), ss)}
        className={`${className} w-[58px] text-right`}
      />
      <span className="text-[13px] text-slate">min</span>
      <input
        aria-label="Secondes"
        type="number"
        inputMode="numeric"
        min={0}
        max={59}
        step={5}
        value={m && ss ? ss : ""}
        placeholder="00"
        onChange={(e) => {
          const v = num(e.target.value);
          // 75 s tapées dans le champ secondes : on reporte la minute plutôt que de tronquer.
          emit(mm + Math.floor(v / 60), v % 60);
        }}
        className={`${className} w-[54px] text-right`}
      />
      <span className="text-[13px] text-slate">s</span>
    </span>
  );
}

// --- Composant ----------------------------------------------------------------

export function StructureBuilder({
  items,
  onChange,
  activity,
  zones,
  onUseDuration,
}: {
  items: BlocItem[];
  onChange: (items: BlocItem[]) => void;
  activity: ActivityDef;
  zones: ZoneLabels;
  onUseDuration?: (minutes: number) => void;
}) {
  const stats = structureStats(items, activity);
  const clone = () => JSON.parse(JSON.stringify(items)) as BlocItem[];
  const put = (fn: (c: BlocItem[]) => void) => {
    const c = clone();
    fn(c);
    onChange(c);
  };

  const graph = stats.flat.map((s) => {
    const z = isZone(s.target.type) ? s.target.zone ?? 0 : 0;
    return { w: Math.max(stepMinutes(s, activity), 0.4), h: z ? 12 + z * 11 : s.stepType === "work" ? 40 : 18, c: z ? ZONE_COLOR[z] : STEP_COLOR[s.stepType] };
  });

  const stepRow = (s: StepItem, path: (c: BlocItem[]) => StepItem, remove: () => void) => {
    const set = (patch: Partial<StepItem>) => put((c) => Object.assign(path(c), patch));
    const unit = unitOf(s);
    const range = isZone(s.target.type) && s.target.zone ? zones[s.target.type as keyof ZoneLabels]?.[s.target.zone - 1] : undefined;
    const input = "rounded-[10px] border border-line bg-white px-2.5 py-2 text-sm text-ink outline-none focus:border-moss";
    return (
      <div key={s.id} className="flex flex-wrap items-center gap-2">
        <span className="h-9 w-1.5 shrink-0 rounded" style={{ background: STEP_COLOR[s.stepType] }} />
        <select aria-label="Type d'étape" value={s.stepType} onChange={(e) => set({ stepType: e.target.value as StepType })} className={`${input} w-[150px]`}>
          {(Object.keys(STEP_LABEL) as StepType[]).map((k) => <option key={k} value={k}>{STEP_LABEL[k]}</option>)}
        </select>
        {unit === "min" && (
          <TimeFields
            value={s.durationValue}
            className={input}
            onChange={(v) => set({ raw: "", durationType: "time", durationValue: v })}
          />
        )}
        {unit !== "libre" && unit !== "min" && (
          <input
            aria-label="Distance"
            value={displayValue(s)}
            placeholder={unit === "km" ? "5" : "400"}
            onChange={(e) => {
              const raw = e.target.value;
              const n = Number(raw.replace(",", ".").replace(/\s/g, ""));
              set({ raw, durationType: "distance", unit, durationValue: raw && !Number.isNaN(n) ? String(Math.round(unit === "km" ? n * 1000 : n)) : "" });
            }}
            className={`${input} w-[76px]`}
          />
        )}
        <select
          aria-label="Unité"
          value={unit}
          onChange={(e) => {
            const u = e.target.value as UnitKind;
            set(u === "libre" ? { durationType: "manual", durationValue: "", raw: "", unit: u } : { durationType: u === "min" ? "time" : "distance", durationValue: "", raw: "", unit: u });
          }}
          className={`${input} w-[92px]`}
        >
          {activity.units.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
        </select>
        <select
          aria-label="Cible"
          value={activity.targets.includes(s.target.type) ? s.target.type : activity.targets[0]}
          onChange={(e) => {
            const t = e.target.value as TargetKind;
            set({ target: isZone(t) ? { type: t, zone: s.target.zone ?? 3 } : { type: t, freeText: s.target.freeText } });
          }}
          className={`${input} w-[170px]`}
        >
          {activity.targets.map((t) => <option key={t} value={t}>{TARGET_LABEL[t]}</option>)}
        </select>
        {isZone(s.target.type) && (
          <>
            <select aria-label="Zone" value={s.target.zone ?? 3} onChange={(e) => set({ target: { ...s.target, zone: Number(e.target.value) } })} className={`${input} w-[64px]`}>
              {[1, 2, 3, 4, 5].map((z) => <option key={z} value={z}>Z{z}</option>)}
            </select>
            {range && <span className="whitespace-nowrap text-[13px] text-ink-soft">{range}</span>}
          </>
        )}
        {s.target.type === "free" && (
          <input aria-label="Cible libre" value={s.target.freeText ?? ""} placeholder={activity.freePh} onChange={(e) => set({ target: { type: "free", freeText: e.target.value } })} className={`${input} w-[240px]`} />
        )}
        {activity.swim && (
          <select aria-label="Nage" value={s.stroke ?? ""} onChange={(e) => set({ stroke: e.target.value || undefined })} className={`${input} w-[120px]`}>
            <option value="">Nage…</option>
            {STROKES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        )}
        <span className="flex-1" />
        <button type="button" onClick={remove} aria-label="Retirer l'étape" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-slate">×</button>
      </div>
    );
  };

  const dashed = "rounded-[10px] border border-dashed border-[#aab4b1] bg-white px-3 py-1.5 text-[13px] font-semibold text-moss";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl bg-[#f7f9f8] px-4 py-3">
        <div className="flex h-[70px] items-end gap-0.5 border-b border-line">
          {graph.length ? graph.map((g, i) => <div key={i} className="rounded-t-[3px]" style={{ flex: g.w, height: g.h, background: g.c }} />) : <div className="h-0.5 flex-1 bg-paper-dim" />}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-7 gap-y-1 text-[13px] text-slate">
          <span><b className="text-base text-ink">{stats.minutes ? `≈ ${fmtMin(stats.minutes)}` : "—"}</b> au total</span>
          {stats.meters > 0 && (activity.swim ? <span><b className="text-base text-ink">{stats.meters}</b> m</span> : <span><b className="text-base text-ink">{String(Math.round(stats.meters / 100) / 10).replace(".", ",")}</b> km en étapes distance</span>)}
          {activity.targets.some(isZone) && <span><b className="text-base text-ink">{stats.hard ? fmtMin(stats.hard) : "—"}</b> en Z3 et plus</span>}
          {onUseDuration && stats.minutes > 0 && (
            <button type="button" onClick={() => onUseDuration(stats.minutes)} className="font-semibold text-moss hover:underline">Reporter dans la durée prévue</button>
          )}
        </div>
      </div>

      {items.map((b, bi) => {
        const sm = structureStats(b.items, activity).minutes;
        return (
          <div key={b.id} className="flex flex-col gap-2.5 rounded-2xl border border-paper-dim bg-[#f7f9f8] p-3.5">
            <div className="flex items-center gap-2.5">
              <select aria-label="Type de bloc" value={b.title} onChange={(e) => put((c) => { c[bi].title = e.target.value; })} className="rounded-[10px] border border-line bg-white px-2.5 py-2 text-sm font-bold text-ink">
                {(BLOC_TITLES.includes(b.title) ? BLOC_TITLES : [b.title, ...BLOC_TITLES]).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {sm > 0 && <span className="text-[13px] text-slate">≈ {fmtMin(sm)}</span>}
              <span className="flex-1" />
              <button type="button" onClick={() => put((c) => { c.splice(bi, 1); })} aria-label="Retirer le bloc" className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-dim text-slate">×</button>
            </div>
            {b.items.map((it, ii) =>
              it.kind === "repeat" ? (
                <div key={it.id} className="flex flex-col gap-2 rounded-xl border border-paper-dim bg-[#fafbfb] p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                    Répéter
                    <input aria-label="Nombre de répétitions" type="number" min={1} value={it.count} onChange={(e) => put((c) => { (c[bi].items[ii] as RepeatItem).count = Math.max(1, Number(e.target.value) || 1); })} className="w-[58px] rounded-[10px] border border-line bg-white px-2 py-1.5 text-center text-sm font-normal" />
                    fois
                    <span className="text-[13px] font-normal text-slate">{(() => { const m = structureStats([it], activity).minutes; return m ? `· ${fmtMin(m)}` : ""; })()}</span>
                    <span className="flex-1" />
                    <button type="button" onClick={() => put((c) => { (c[bi].items[ii] as RepeatItem).steps.push(newStep("work", activity)); })} className="text-[13px] font-semibold text-moss">+ Étape dans la répétition</button>
                    <button type="button" onClick={() => put((c) => { c[bi].items.splice(ii, 1); })} aria-label="Retirer la répétition" className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-slate">×</button>
                  </div>
                  {it.steps.map((s, si) => (
                    <div key={s.id} className="ml-4">
                      {stepRow(s, (c) => (c[bi].items[ii] as RepeatItem).steps[si], () => put((c) => { const r = c[bi].items[ii] as RepeatItem; r.steps.splice(si, 1); if (!r.steps.length) c[bi].items.splice(ii, 1); }))}
                    </div>
                  ))}
                </div>
              ) : (
                stepRow(it, (c) => c[bi].items[ii] as StepItem, () => put((c) => { c[bi].items.splice(ii, 1); }))
              )
            )}
            <div className="flex gap-2">
              <button type="button" className={dashed} onClick={() => put((c) => { const t = c[bi].title === "Échauffement" ? "warmup" : c[bi].title === "Retour au calme" ? "cooldown" : "work"; c[bi].items.push(newStep(t, activity)); })}>+ Étape</button>
              <button type="button" className={dashed} onClick={() => put((c) => { c[bi].items.push({ id: uid(), kind: "repeat", count: 4, steps: [newStep("work", activity), newStep("recovery", activity)] }); })}>+ Répétition</button>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        <button type="button" className={dashed} onClick={() => onChange([...items, { id: uid(), kind: "bloc", title: "Corps de séance", items: [newStep("work", activity)] }])}>+ Bloc</button>
        {activity.targets.some(isZone) && <span className="text-[13px] text-slate">Zones calculées à partir des mesures de l&apos;athlète</span>}
      </div>
    </div>
  );
}
