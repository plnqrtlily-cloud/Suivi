"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TrainingPeriod } from "@/lib/queries";
import type { LoadWeek } from "@/lib/athlete-overview";
import {
  PERIOD_LEVELS,
  FOCUS_PRESETS,
  LOAD_PATTERNS,
  focusLabel,
  focusPreset,
  periodColor,
  periodWeeks,
  periodDays,
  deloadWeeks,
  weekPosition,
  periodsOnDate,
  type LoadPattern,
} from "@/lib/periodization";
import {
  createTrainingPeriodAction,
  updateTrainingPeriodAction,
  deleteTrainingPeriodAction,
  duplicateTrainingPeriodAction,
} from "@/lib/actions";
import { Panel, TabHeader, GoalCountdown, Reveal, ghostBtn, primaryBtn, fieldClass, fieldLabel } from "./tab-ui";

const LEVEL_LABEL: Record<string, string> = { saison: "Saison", bloc: "Blocs", cycle: "Cycles" };
const LEVEL_ONE: Record<string, string> = { saison: "Saison", bloc: "Bloc", cycle: "Cycle" };
const VOLUMES = ["faible", "modéré", "élevé"];
const INTENSITIES = ["faible", "modérée", "élevée", "maximale"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function longDate(iso: string) {
  const d = parse(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
const fmtN = (n: number) => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ");

function PeriodFields({ period, defaults }: { period?: TrainingPeriod; defaults?: { start: string } }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={fieldLabel}>Niveau</label>
          <select name="level" defaultValue={period?.level ?? "cycle"} className={fieldClass}>
            {PERIOD_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={fieldLabel}>Nom</label>
          <input name="name" defaultValue={period?.name ?? ""} placeholder="Laissé vide : le nom de l'orientation" className={fieldClass} />
        </div>
      </div>
      <div>
        <label className={fieldLabel}>Orientation</label>
        <select name="focus" defaultValue={period?.focus ?? ""} className={fieldClass}>
          <option value="">Sans orientation</option>
          {FOCUS_PRESETS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label} · ~{f.typicalWeeks} sem.
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={fieldLabel}>Début</label>
          <input type="date" name="startDate" defaultValue={period?.start_date ?? defaults?.start ?? ""} required className={fieldClass} />
        </div>
        <div>
          <label className={fieldLabel}>Fin</label>
          <input type="date" name="endDate" defaultValue={period?.end_date ?? ""} className={fieldClass} />
        </div>
        <div>
          <label className={fieldLabel}>ou durée (semaines)</label>
          <input type="number" name="weeks" min={1} max={104} placeholder="4" className={fieldClass} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={fieldLabel}>Schéma de charge</label>
          <select name="loadPattern" defaultValue={period?.load_pattern ?? "3:1"} className={fieldClass}>
            {LOAD_PATTERNS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabel}>Volume</label>
          <select name="volume" defaultValue={period?.volume ?? ""} className={fieldClass}>
            <option value="">—</option>
            {VOLUMES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabel}>Intensité</label>
          <select name="intensity" defaultValue={period?.intensity ?? ""} className={fieldClass}>
            <option value="">—</option>
            {INTENSITIES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={fieldLabel}>Objectif de la période</label>
        <input name="objective" defaultValue={period?.objective ?? ""} placeholder="ex. tenir 5 × 4 min à 300 W en fin de cycle" className={fieldClass} />
      </div>
      <div>
        <label className={fieldLabel}>Notes</label>
        <textarea name="notes" defaultValue={period?.notes ?? ""} rows={2} className={fieldClass} />
      </div>
    </div>
  );
}

export function PeriodizationPanel({
  athleteId,
  periods,
  today,
  span,
  weeks,
  goal,
}: {
  athleteId: string;
  periods: TrainingPeriod[];
  today: string;
  span: { from: string; to: string; seasonId: string | null };
  weeks: LoadWeek[];
  goal: { title: string; date: string; dateLabel: string; days: number } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = periodsOnDate(periods, today);
  const finest = active[active.length - 1] ?? null;
  const [selId, setSelId] = useState<string | null>(finest?.id ?? periods[0]?.id ?? null);
  const [mode, setMode] = useState<"view" | "edit" | "add">("view");
  const selected = periods.find((p) => p.id === selId) ?? null;
  const season = periods.find((p) => p.id === span.seasonId) ?? null;

  const total = periodDays(span.from, span.to);
  const pct = (iso: string) => Math.min(100, Math.max(0, ((periodDays(span.from, iso) - 1) / total) * 100));
  const inSpan = (p: TrainingPeriod) => p.end_date >= span.from && p.start_date <= span.to;
  const todayPct = today >= span.from && today <= span.to ? pct(today) : null;
  const goalPct = goal && goal.date >= span.from && goal.date <= span.to ? pct(goal.date) : null;

  const months = useMemo(() => {
    const out: { label: string; left: number }[] = [];
    const d = parse(span.from);
    d.setDate(1);
    if (parse(span.from).getDate() > 1) d.setMonth(d.getMonth() + 1);
    while (true) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      if (iso > span.to) break;
      out.push({ label: MONTHS_SHORT[d.getMonth()], left: pct(iso) });
      d.setMonth(d.getMonth() + 1);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [span.from, span.to]);

  const usedFocus = FOCUS_PRESETS.filter((f) => periods.some((p) => inSpan(p) && p.focus === f.value));
  const maxLoad = Math.max(1, ...weeks.map((w) => (w.isFuture ? w.plannedLoad : Math.max(w.load, w.plannedLoad))));

  function run(fn: (fd: FormData) => Promise<unknown>, fd: FormData, after?: () => void) {
    start(async () => {
      await fn(fd);
      after?.();
      router.refresh();
    });
  }

  const block = active.find((p) => p.level === "bloc");
  const subtitle = [
    goal ? `Objectif : ${goal.title}, ${longDate(goal.date)}` : null,
    block ? `bloc « ${block.name} »` : null,
    finest && finest.level === "cycle" ? `cycle « ${finest.name} »` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <TabHeader
        title={season?.name ?? "Périodisation"}
        subtitle={subtitle || "Découpez la saison en blocs et en cycles pour donner une direction à la programmation."}
        right={<GoalCountdown goal={goal} />}
      />

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="text-[17px] font-bold tracking-tight text-ink">{season?.name ?? "Frise"}</h3>
          <span className="text-[13px] text-slate">
            {longDate(span.from)} → {longDate(span.to)} · {periodWeeks(span.from, span.to)} semaines
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
            {usedFocus.map((f) => (
              <span key={f.value} className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm" style={{ background: f.color }} />
                {f.label}
              </span>
            ))}
            <button type="button" className={ghostBtn} onClick={() => setMode(mode === "add" ? "view" : "add")}>
              {mode === "add" ? "Fermer" : "+ Période"}
            </button>
          </div>
        </div>

        <Reveal open={mode === "add"}>
          <form
            className="mb-5 rounded-2xl bg-paper p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("athleteId", athleteId);
              run(createTrainingPeriodAction, fd, () => setMode("view"));
            }}
          >
            <PeriodFields defaults={{ start: today }} />
            <button type="submit" disabled={pending} className={`${primaryBtn} mt-4`}>
              Ajouter la période
            </button>
          </form>
        </Reveal>

        {periods.length === 0 ? (
          <p className="text-sm text-slate">Aucune période pour l&apos;instant : commencez par la saison, puis ses blocs et ses cycles.</p>
        ) : (
          <div className="grid grid-cols-[64px_1fr] gap-x-3 sm:grid-cols-[80px_1fr]">
            <span />
            <div className="relative mb-2 h-4 text-[11px] text-slate">
              {months.map((m) => (
                <span key={m.left} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${m.left}%` }}>
                  {m.label}
                </span>
              ))}
            </div>

            {(["saison", "bloc", "cycle"] as const).map((level) => {
              const items = periods.filter((p) => p.level === level && inSpan(p));
              if (items.length === 0) return null;
              return (
                <div key={level} className="contents">
                  <span className="flex h-10 items-center text-[13px] font-semibold text-ink">{LEVEL_LABEL[level]}</span>
                  <div className="relative h-10">
                    {items.map((p) => {
                      const left = pct(p.start_date < span.from ? span.from : p.start_date);
                      const right = pct(p.end_date > span.to ? span.to : p.end_date) + (1 / total) * 100;
                      const isSel = p.id === selId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          title={`${p.name} · ${longDate(p.start_date)} → ${longDate(p.end_date)}`}
                          onClick={() => {
                            setSelId(p.id);
                            setMode("view");
                          }}
                          className={`absolute top-1 flex h-8 items-center overflow-hidden rounded-lg px-2 text-left text-[12px] font-semibold text-white transition-shadow ${
                            isSel ? "ring-2 ring-ink ring-offset-1" : "hover:brightness-110"
                          }`}
                          style={{
                            left: `calc(${left}% + 1px)`,
                            width: `calc(${Math.max(1, right - left)}% - 3px)`,
                            background: periodColor(p.focus, p.color),
                          }}
                        >
                          <span className="truncate">{p.name}</span>
                        </button>
                      );
                    })}
                    {todayPct !== null && (
                      <span className="pointer-events-none absolute -bottom-1 -top-1 z-10 w-[2px] bg-[#a4492a]" style={{ left: `${todayPct}%` }} />
                    )}
                  </div>
                </div>
              );
            })}

            <span className="flex h-16 items-center text-[13px] font-semibold text-ink">Charge</span>
            <div className="relative mt-2 h-16">
              <div className="absolute inset-0 flex items-end gap-[2px]">
                {weeks.map((w) => {
                  const v = w.isFuture ? w.plannedLoad : w.load || 0;
                  return (
                    <span
                      key={w.weekStart}
                      title={`S${w.number} · ${w.isFuture ? `${fmtN(w.plannedLoad)} UA prévues` : `${fmtN(w.load)} UA`}`}
                      className={`flex-1 rounded-t-[3px] ${w.isFuture ? "bg-[#c5dcda]" : w.isCurrent ? "bg-[#5d8c8f]" : "bg-[#1d4a4f]"}`}
                      style={{ height: `${Math.max(3, (v / maxLoad) * 100)}%` }}
                    />
                  );
                })}
              </div>
              {todayPct !== null && (
                <span className="pointer-events-none absolute -top-3 bottom-0 z-10 w-[2px] bg-[#a4492a]" style={{ left: `${todayPct}%` }} />
              )}
            </div>
            <span />
            <div className="relative h-6 text-[11px] font-semibold">
              {todayPct !== null && (
                <span className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap text-[#a4492a]" style={{ left: `${todayPct}%` }}>
                  Aujourd&apos;hui
                </span>
              )}
              {goalPct !== null && goal && Math.abs(goalPct - (todayPct ?? -50)) > 6 && (
                <span className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap text-ink" style={{ left: `${goalPct}%` }}>
                  {goal.title}
                </span>
              )}
            </div>
          </div>
        )}
      </Panel>

      {selected && (
        <PeriodDetail
          key={selected.id}
          period={selected}
          periods={periods}
          weeks={weeks}
          today={today}
          editing={mode === "edit"}
          pending={pending}
          onEdit={() => setMode(mode === "edit" ? "view" : "edit")}
          onSave={(fd) => {
            fd.set("periodId", selected.id);
            run(updateTrainingPeriodAction, fd, () => setMode("view"));
          }}
          onDuplicate={() => {
            const fd = new FormData();
            fd.set("periodId", selected.id);
            start(async () => {
              const res = (await duplicateTrainingPeriodAction(fd)) as { id: string } | undefined;
              if (res?.id) setSelId(res.id);
              router.refresh();
            });
          }}
          onDelete={() => {
            const fd = new FormData();
            fd.set("periodId", selected.id);
            run(deleteTrainingPeriodAction, fd, () => setSelId(null));
          }}
        />
      )}
    </div>
  );
}

function PeriodDetail({
  period: p,
  periods,
  weeks,
  today,
  editing,
  pending,
  onEdit,
  onSave,
  onDuplicate,
  onDelete,
}: {
  period: TrainingPeriod;
  periods: TrainingPeriod[];
  weeks: LoadWeek[];
  today: string;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onSave: (fd: FormData) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const color = periodColor(p.focus, p.color);
  const preset = focusPreset(p.focus);
  const nWeeks = periodWeeks(p.start_date, p.end_date);
  const pos = weekPosition(p, today);
  const pattern = (p.load_pattern as LoadPattern) || "plat";
  const deloads = deloadWeeks(pattern, nWeeks);
  const patternDef = LOAD_PATTERNS.find((x) => x.value === pattern);

  // Une carte par semaine de la période : le cycle qui l'occupe (pour un bloc
  // ou une saison) ou son statut de charge (pour un cycle), et la charge.
  const cards = Array.from({ length: nWeeks }, (_, i) => {
    const d = parse(p.start_date);
    d.setDate(d.getDate() + i * 7);
    const startISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const mid = new Date(d);
    mid.setDate(mid.getDate() + 3);
    const midISO = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, "0")}-${String(mid.getDate()).padStart(2, "0")}`;
    const wk = weeks.find((w) => w.weekStart <= midISO && midISO <= addDaysISO(w.weekStart, 6));
    const child =
      p.level === "cycle"
        ? null
        : periodsOnDate(periods, midISO).filter((x) => x.id !== p.id && (p.level === "saison" ? x.level !== "saison" : x.level === "cycle")).pop();
    const deload = deloads.includes(i + 1);
    const current = startISO <= today && today <= addDaysISO(startISO, 6);
    return { i, startISO, wk, child, deload, current, past: addDaysISO(startISO, 6) < today };
  });

  return (
    <Panel>
      <div className="flex flex-wrap items-start gap-4">
        <span className="w-1 self-stretch rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-slate">
            {LEVEL_ONE[p.level]} · {focusLabel(p.focus)}
          </p>
          <h3 className="text-[22px] font-bold leading-tight tracking-tight text-ink">{p.name}</h3>
          <p className="text-sm text-ink-soft">
            Du {longDate(p.start_date)} au {longDate(p.end_date)} · {nWeeks} semaine{nWeeks > 1 ? "s" : ""}
            {pos ? ` · semaine ${pos.week} sur ${pos.totalWeeks}` : p.end_date < today ? " · terminé" : " · à venir"}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onEdit} className={ghostBtn}>
            {editing ? "Annuler" : "Modifier"}
          </button>
          <button type="button" onClick={onDuplicate} disabled={pending} className={ghostBtn}>
            Dupliquer
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Supprimer « ${p.name} » ?`)) onDelete();
            }}
            disabled={pending}
            aria-label="Supprimer la période"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-line text-lg leading-none text-slate hover:text-clay"
          >
            ×
          </button>
        </div>
      </div>

      <Reveal open={editing}>
        <form
          className="mt-5 rounded-2xl bg-paper p-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(new FormData(e.currentTarget));
          }}
        >
          <PeriodFields period={p} />
          <button type="submit" disabled={pending} className={`${primaryBtn} mt-4`}>
            Enregistrer
          </button>
        </form>
      </Reveal>

      <div className="mt-5 grid gap-5 border-y border-line py-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[13px] text-slate">Orientation</p>
          <p className="text-[17px] font-bold text-ink">{preset?.label ?? "Libre"}</p>
          {preset && <p className="text-xs text-slate">{preset.description}</p>}
        </div>
        <div>
          <p className="text-[13px] text-slate">Schéma de charge</p>
          <p className="text-[17px] font-bold text-ink">{patternDef?.label ?? "—"}</p>
          <p className="text-xs text-slate">{pattern === "plat" ? "charge régulière" : "semaines de charge : décharge"}</p>
        </div>
        <div>
          <p className="text-[13px] text-slate">Volume</p>
          <p className="text-[17px] font-bold text-ink">{p.volume ?? preset?.volume ?? "—"}</p>
          <p className="text-xs text-slate">sur la période</p>
        </div>
        <div>
          <p className="text-[13px] text-slate">Intensité</p>
          <p className="text-[17px] font-bold text-ink">{p.intensity ?? preset?.intensity ?? "—"}</p>
          <p className="text-xs text-slate">dominante</p>
        </div>
      </div>

      <p className="mb-3 mt-5 text-[15px] font-semibold text-ink">Semaine par semaine</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {cards.map((c) => (
          <div
            key={c.i}
            className={`min-w-[150px] flex-1 rounded-2xl px-3 py-2.5 ${
              c.current ? "bg-[#1d4a4f] text-white" : c.deload ? "border border-dashed border-line bg-white" : "bg-paper"
            }`}
          >
            <p className={`text-xs ${c.current ? "text-white/80" : "text-slate"}`}>
              Semaine {c.wk?.number ?? c.i + 1}
              {c.current ? " · en cours" : ""}
            </p>
            <p className={`truncate text-sm font-semibold ${c.current ? "text-white" : "text-ink"}`}>
              {c.child?.name ?? (c.deload ? "Décharge" : "Charge")}
            </p>
            <p className={`text-xs ${c.current ? "text-white/80" : "text-slate"}`}>
              {c.child ? (c.deload ? "Décharge" : "Charge") : ""}
              {c.child && c.wk && (c.wk.load || c.wk.plannedLoad) ? " · " : ""}
              {c.wk
                ? c.past || c.current
                  ? c.wk.load
                    ? `${fmtN(c.wk.load)} UA`
                    : ""
                  : c.wk.plannedLoad
                    ? `${fmtN(c.wk.plannedLoad)} UA prévues`
                    : ""
                : ""}
              {"\u00a0"}
            </p>
          </div>
        ))}
      </div>

      {(p.objective || p.notes) && (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {p.objective && (
            <div>
              <p className="mb-1 text-[15px] font-semibold text-ink">Objectif de la période</p>
              <p className="text-sm text-ink-soft">{p.objective}</p>
            </div>
          )}
          {p.notes && (
            <div>
              <p className="mb-1 text-[15px] font-semibold text-ink">Notes</p>
              <p className="whitespace-pre-line text-sm text-ink-soft">{p.notes}</p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function addDaysISO(iso: string, n: number) {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
