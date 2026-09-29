"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveInjuryForAthleteAction,
  setInjuryImpactAction,
  addInjuryFollowupAction,
  healInjuryAction,
  deleteInjuryForAthleteAction,
} from "@/lib/actions";
import type { CycleSummary, CycleRingView } from "@/lib/athlete-overview";
import { BODY_PARTS, SIDES, INJURY_TYPES, IMPACT_LABEL, NEXT_IMPACT, type Impact } from "@/lib/injury-catalog";
import { Panel, PanelTitle, Row, TabHeader, ghostBtn, primaryBtn, fieldClass, fieldLabel } from "./tab-ui";

export interface InjuryView {
  id: string;
  label: string;
  bodyPart: string | null;
  side: string | null;
  type: string | null;
  pain: number | null;
  dateStart: string;
  dateEnd: string | null;
  returnDate: string | null;
  description: string | null;
  advice: string | null;
  impact: Record<string, Impact>;
  followups: { id: string; date: string; pain: number; note: string | null }[];
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function frs(iso: string, year = false) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${year ? ` ${y}` : ""}`;
}
function frd(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS_LONG[m - 1]} ${y}`;
}
function days(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
}
function duration(n: number) {
  if (n < 14) return `${n} jour${n > 1 ? "s" : ""}`;
  if (n < 60) return `${Math.round(n / 7)} semaines`;
  return `${Math.round(n / 30.4)} mois`;
}
const IMPACT_STYLE: Record<Impact, string> = {
  ok: "bg-paper-dim text-ink-soft",
  adapte: "bg-[#fbf1dc] text-[#7a5a14]",
  arret: "bg-[#f7e1d8] text-[#a4492a]",
};
const SEC = "text-[11.5px] font-bold uppercase tracking-wide text-slate";

function currentPain(i: InjuryView) {
  return i.followups.length ? i.followups[i.followups.length - 1].pain : i.pain ?? 0;
}

function PainLine({ injury }: { injury: InjuryView }) {
  const pts = [{ date: injury.dateStart, pain: injury.pain ?? 0 }, ...injury.followups.map((f) => ({ date: f.date, pain: f.pain }))];
  if (pts.length < 2) return null;
  const t0 = new Date(pts[0].date).getTime();
  const t1 = new Date(pts[pts.length - 1].date).getTime();
  const rd = (v: number) => Math.round(v * 100) / 100;
  const x = (d: string, i: number) => rd(t1 > t0 ? ((new Date(d).getTime() - t0) / (t1 - t0)) * 100 : (i / (pts.length - 1)) * 100);
  const y = (p: number) => rd(6 + ((10 - p) / 10) * 88);
  return (
    <div>
      <p className={SEC}>Évolution de la douleur</p>
      <div className="relative mx-2 mt-5 h-16">
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <polyline points={pts.map((p, i) => `${(x(p.date, i) * 3).toFixed(1)},${y(p.pain).toFixed(1)}`).join(" ")} fill="none" stroke="#a4492a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        {pts.map((p, i) => (
          <span key={i} className="absolute" style={{ left: `${x(p.date, i)}%`, top: `${rd(y(p.pain) * 0.64)}px` }} title={`${frs(p.date)} · douleur ${p.pain}/10`}>
            <span className="absolute -left-1 -top-1 block h-2 w-2 rounded-full border-2 border-white bg-[#a4492a]" />
            <span className="absolute -top-6 -translate-x-1/2 text-[11px] font-bold text-ink">{p.pain}</span>
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate">
        <span>{frs(pts[0].date)}</span>
        <span>{frs(pts[pts.length - 1].date)}</span>
      </div>
    </div>
  );
}

function Followups({ injury }: { injury: InjuryView }) {
  if (!injury.followups.length) return null;
  return (
    <div>
      <p className={SEC}>Suivi</p>
      <ul className="mt-1">
        {[...injury.followups].reverse().map((f) => (
          <li key={f.id} className="grid grid-cols-[84px_44px_1fr] gap-2 border-t border-line/70 py-1.5 text-[13px]">
            <span className="text-slate">{frs(f.date)}</span>
            <b className="text-ink">{f.pain}/10</b>
            <span className="text-ink-soft">{f.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImpactChips({ injury, sports, editable }: { injury: InjuryView; sports: { key: string; label: string }[]; editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5">
      {sports.map((sp) => {
        const k: Impact = injury.impact[sp.key] ?? "ok";
        const cls = `rounded-full px-2.5 py-1 text-[12px] font-semibold ${IMPACT_STYLE[k]}`;
        return editable ? (
          <button
            key={sp.key}
            type="button"
            disabled={pending}
            title="Cliquer pour passer de Normal à Adapté puis Arrêt"
            onClick={() =>
              start(async () => {
                await setInjuryImpactAction(injury.id, { ...injury.impact, [sp.key]: NEXT_IMPACT[k] });
                router.refresh();
              })
            }
            className={cls}
          >
            {sp.label} · {IMPACT_LABEL[k]}
          </button>
        ) : (
          <span key={sp.key} className={cls}>
            {sp.label} · {IMPACT_LABEL[k]}
          </span>
        );
      })}
    </div>
  );
}

function InjuryForm({
  athleteId,
  injury,
  preset,
  sports,
  today,
  onDone,
}: {
  athleteId: string;
  injury: InjuryView | null;
  preset?: Partial<InjuryView>;
  sports: { key: string; label: string }[];
  today: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const src = injury ?? preset ?? {};
  const known = src.bodyPart && (BODY_PARTS as readonly string[]).includes(src.bodyPart);
  const [part, setPart] = useState<string>(src.bodyPart ? (known ? src.bodyPart : "__autre") : "Genou");
  const [impact, setImpact] = useState<Record<string, Impact>>(src.impact ?? {});
  const [error, setError] = useState("");

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-paper p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("athleteId", athleteId);
        fd.set("bodyPart", part);
        fd.set("impact", JSON.stringify(impact));
        if (injury) fd.set("id", injury.id);
        setError("");
        start(async () => {
          const r = await saveInjuryForAthleteAction(fd);
          if ("error" in r) {
            setError(r.error);
            return;
          }
          onDone();
          router.refresh();
        });
      }}
    >
      <p className="text-[14.5px] font-semibold text-ink">{injury ? `Modifier · ${injury.label}` : "Nouvelle blessure"}</p>
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <label>
          <span className={fieldLabel}>Zone</span>
          <select value={part} onChange={(e) => setPart(e.target.value)} className={fieldClass}>
            {BODY_PARTS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            <option value="__autre">Autre…</option>
          </select>
        </label>
        <label>
          <span className={fieldLabel}>Côté</span>
          <select name="side" defaultValue={src.side ?? ""} className={fieldClass}>
            {SIDES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {part === "__autre" && (
        <label>
          <span className={fieldLabel}>Nom de la zone</span>
          <input name="otherPart" required defaultValue={known ? "" : src.bodyPart ?? src.label ?? ""} placeholder="ex. Fascia lata" className={fieldClass} />
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <label>
          <span className={fieldLabel}>Type</span>
          <select name="type" defaultValue={src.type ?? "Tendinopathie"} className={fieldClass}>
            {INJURY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={fieldLabel}>Douleur</span>
          <select name="pain" defaultValue={String(src.pain ?? 4)} className={fieldClass}>
            {Array.from({ length: 11 }, (_, v) => (
              <option key={v} value={v}>
                {v} / 10{v === 0 ? " · aucune" : v <= 3 ? " · légère" : v <= 6 ? " · modérée" : " · forte"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={fieldLabel}>Depuis le</span>
          <input type="date" name="dateStart" required defaultValue={src.dateStart ?? today} className={fieldClass} />
        </label>
        <label>
          <span className={fieldLabel}>Retour prévu</span>
          <input type="date" name="returnDate" defaultValue={src.returnDate ?? ""} className={fieldClass} />
        </label>
        <label>
          <span className={fieldLabel}>Guérie le (antécédent)</span>
          <input type="date" name="dateEnd" defaultValue={injury?.dateEnd ?? ""} className={fieldClass} />
        </label>
      </div>
      <label>
        <span className={fieldLabel}>Description</span>
        <textarea name="description" rows={2} defaultValue={src.description ?? ""} placeholder="Contexte, diagnostic, examens…" className={fieldClass} />
      </label>
      <label>
        <span className={fieldLabel}>Consignes d’entraînement</span>
        <textarea name="advice" rows={2} defaultValue={src.advice ?? ""} placeholder="Ce qu’on arrête, ce qu’on adapte, la rééducation…" className={fieldClass} />
      </label>
      {sports.length > 0 && (
        <div>
          <span className={fieldLabel}>Impact par sport (cliquer pour passer de Normal à Adapté puis Arrêt)</span>
          <div className="flex flex-wrap gap-1.5">
            {sports.map((sp) => {
              const k: Impact = impact[sp.key] ?? "ok";
              return (
                <button key={sp.key} type="button" onClick={() => setImpact({ ...impact, [sp.key]: NEXT_IMPACT[k] })} className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${IMPACT_STYLE[k]}`}>
                  {sp.label} · {IMPACT_LABEL[k]}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryBtn}>
          Enregistrer
        </button>
        <button type="button" onClick={onDone} className="text-[13px] font-semibold text-slate hover:text-ink">
          Annuler
        </button>
        {error && <span className="text-sm text-clay">{error}</span>}
      </div>
    </form>
  );
}

function ActiveInjury({ injury, sports, today, onEdit }: { injury: InjuryView; sports: { key: string; label: string }[]; today: string; onEdit: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"follow" | "heal" | null>(null);
  const [error, setError] = useState("");
  const pain = currentPain(injury);
  const prev = injury.followups.length > 1 ? injury.followups[injury.followups.length - 2].pain : injury.pain ?? pain;
  const trend = injury.followups.length ? (pain < prev ? "↘ en baisse" : pain > prev ? "↗ en hausse" : "→ stable") : "à la déclaration";
  const ret = injury.returnDate
    ? injury.returnDate >= today
      ? `Retour prévu le ${frs(injury.returnDate)} · dans ${days(today, injury.returnDate)} j`
      : `Retour prévu le ${frs(injury.returnDate)} · dépassé de ${days(injury.returnDate, today)} j`
    : "Pas de date de retour prévue";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date") || "");
    const note = String(fd.get("note") || "");
    setError("");
    start(async () => {
      const r = mode === "follow" ? await addInjuryFollowupAction(injury.id, date, Number(fd.get("pain") || 0), note) : await healInjuryAction(injury.id, date, note);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setMode(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#f0dcd3] bg-[#fbf3ef] p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#a4492a]" />
        <div className="min-w-0 flex-1">
          <p className="text-[15.5px] font-bold text-ink">
            {injury.label} {injury.type && <span className="font-medium text-ink-soft">· {injury.type}</span>}
          </p>
          <p className="text-[13px] text-slate">
            depuis le {frd(injury.dateStart)} · J+{days(injury.dateStart, today)}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-[22px] font-bold leading-none tracking-tight ${pain >= 6 ? "text-[#a4492a]" : pain >= 3 ? "text-[#b07a1c]" : "text-moss-dark"}`}>{pain}/10</p>
          <p className="text-[11.5px] text-slate">douleur · {trend}</p>
        </div>
        <button type="button" onClick={onEdit} aria-label="Modifier" title="Modifier" className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-white">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 3.5l3 3L7 16H4v-3z" />
          </svg>
        </button>
      </div>
      {injury.description && <p className="text-[13.5px] text-ink-soft">{injury.description}</p>}
      <div className="flex flex-col gap-1.5">
        <p className={SEC}>Consignes</p>
        <p className="text-[13.5px] leading-relaxed text-ink">{injury.advice || "Pas de consigne particulière."}</p>
        <ImpactChips injury={injury} sports={sports} editable />
        <p className="text-[12.5px] text-slate">{ret}</p>
      </div>
      <PainLine injury={injury} />
      <Followups injury={injury} />
      {mode ? (
        <form onSubmit={submit} className="flex flex-col gap-2.5 rounded-xl bg-white p-3">
          <p className="text-sm font-semibold text-ink">{mode === "follow" ? "Point de suivi" : "Marquer guérie"}</p>
          <div className={`grid gap-2.5 ${mode === "follow" ? "sm:grid-cols-[1fr_1fr_2fr]" : "sm:grid-cols-[1fr_2fr]"}`}>
            <input type="date" name="date" required defaultValue={today} className={fieldClass} />
            {mode === "follow" && (
              <select name="pain" defaultValue={String(pain)} className={fieldClass}>
                {Array.from({ length: 11 }, (_, v) => (
                  <option key={v} value={v}>
                    Douleur {v}/10
                  </option>
                ))}
              </select>
            )}
            <input name="note" placeholder={mode === "follow" ? "Sensations, examen, reprise…" : "Séquelles, prévention à garder…"} className={fieldClass} />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className={primaryBtn}>
              {mode === "follow" ? "Ajouter" : "Passer en antécédent"}
            </button>
            <button type="button" onClick={() => setMode(null)} className="text-[13px] font-semibold text-slate">
              Annuler
            </button>
            {error && <span className="text-sm text-clay">{error}</span>}
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("follow")} className={ghostBtn}>
            + Point de suivi
          </button>
          <button type="button" onClick={() => setMode("heal")} className={primaryBtn}>
            Marquer guérie
          </button>
        </div>
      )}
    </div>
  );
}

function PastInjury({ injury, sports, open, onToggle, onEdit, onRelapse }: { injury: InjuryView; sports: { key: string; label: string }[]; open: boolean; onToggle: () => void; onEdit: () => void; onRelapse: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const n = days(injury.dateStart, injury.dateEnd!) || 1;
  const hasImpact = Object.values(injury.impact).some((v) => v !== "ok");
  return (
    <li className="flex flex-col">
      <button type="button" onClick={onToggle} className={`-mx-2 flex gap-3 rounded-lg border-t border-line px-2 py-3 text-left transition-colors hover:bg-paper-dim ${open ? "bg-paper-dim" : ""}`}>
        <span className="w-[3px] shrink-0 rounded-full bg-[#c9a48f]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[15px] font-semibold text-ink">{injury.label}</p>
            <p className="text-[13px] text-slate">
              {frs(injury.dateStart, true)} → {frs(injury.dateEnd!, true)}
            </p>
          </div>
          <p className="text-[13px] text-ink-soft">
            {injury.type ? `${injury.type} · ` : ""}
            {duration(n)}
          </p>
          {(injury.advice || injury.description) && <p className="text-[13px] text-slate">{injury.advice || injury.description}</p>}
        </div>
      </button>
      {open && (
        <div className="relative mb-2 mt-2 animate-expand-in">
          <span className="absolute -top-[7px] left-6 h-3.5 w-3.5 rotate-45 border-l border-t border-line bg-paper" />
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
            <div className="grid gap-x-5 gap-y-1 text-[13.5px] sm:grid-cols-2">
              {[
                ["Type", injury.type ?? "—"],
                ["Période", `${frd(injury.dateStart)} → ${frd(injury.dateEnd!)} (${duration(n)})`],
                ["Douleur au début", injury.pain !== null ? `${injury.pain}/10` : "—"],
                ["Retour prévu", injury.returnDate ? frd(injury.returnDate) : "—"],
              ].map(([l, v]) => (
                <Row key={l} label={l} value={v} />
              ))}
            </div>
            {injury.description && (
              <div>
                <p className={SEC}>Description</p>
                <p className="text-[13.5px] text-ink-soft">{injury.description}</p>
              </div>
            )}
            {(injury.advice || hasImpact) && (
              <div className="flex flex-col gap-1.5">
                <p className={SEC}>Consignes appliquées</p>
                {injury.advice && <p className="text-[13.5px] text-ink-soft">{injury.advice}</p>}
                {hasImpact && <ImpactChips injury={injury} sports={sports} editable={false} />}
              </div>
            )}
            <PainLine injury={injury} />
            <Followups injury={injury} />
            {confirm ? (
              <div className="flex items-center gap-3 border-t border-line pt-3 text-[13.5px]">
                <span className="text-ink-soft">Supprimer cette blessure et son suivi ?</span>
                <span className="flex-1" />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await deleteInjuryForAthleteAction(injury.id);
                      router.refresh();
                    })
                  }
                  className="rounded-full bg-clay px-3.5 py-1.5 text-[13px] font-semibold text-white"
                >
                  Supprimer
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="text-[13px] font-semibold text-slate">
                  Annuler
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-t border-line pt-3">
                <button type="button" onClick={onEdit} className={primaryBtn}>
                  Modifier
                </button>
                <button type="button" onClick={onRelapse} className={ghostBtn}>
                  Déclarer une rechute
                </button>
                <span className="flex-1" />
                <button type="button" onClick={() => setConfirm(true)} className={`${ghostBtn} !text-clay`}>
                  Supprimer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function CycleRing({ ring, firstName }: { ring: CycleRingView; firstName: string }) {
  const [sel, setSel] = useState(ring.phaseNow);
  const R = 92;
  const C = 2 * Math.PI * R;
  const ang = (j: number) => (j / ring.len) * 2 * Math.PI - Math.PI / 2;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const at = (j: number, r: number) => ({ x: r2(130 + r * Math.cos(ang(j))), y: r2(130 + r * Math.sin(ang(j))) });
  const now = ring.phases.find((p) => p.key === ring.phaseNow)!;
  const s = ring.phases.find((p) => p.key === sel)!;
  const today = at(ring.day - 0.5, R);
  const tick = at(ring.day - 0.5, R - 24);
  const fmt = (v: number | null) => (v === null ? "—" : String(v).replace(".", ","));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-center gap-5 sm:grid-cols-[240px_1fr]">
        <div className="relative mx-auto h-[240px] w-[240px]">
          <svg viewBox="0 0 260 260" className="absolute inset-0 h-full w-full overflow-visible">
            <circle cx="130" cy="130" r={R} fill="none" stroke="#f2f4f3" strokeWidth="22" />
            {ring.phases.map((p) => {
              const L = ((p.to - p.from + 1) / ring.len) * C;
              const on = sel === p.key;
              return (
                <circle
                  key={p.key}
                  cx="130"
                  cy="130"
                  r={R}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={on ? 30 : 22}
                  strokeDasharray={`${r2(Math.max(1, L - 4))} ${r2(C - L + 4)}`}
                  strokeDashoffset={r2(-((p.from - 1) / ring.len) * C - 2)}
                  opacity={on ? 1 : 0.5}
                  transform="rotate(-90 130 130)"
                  onClick={() => setSel(p.key)}
                  className="cursor-pointer transition-all"
                >
                  <title>{p.label}</title>
                </circle>
              );
            })}
            {Array.from({ length: ring.len }, (_, i) => {
              const j = i + 1;
              if (j === ring.day) return null;
              const q = at(j - 0.5, R - 24);
              return <circle key={j} cx={q.x} cy={q.y} r={j % 7 === 0 ? 2.2 : 1.4} fill={j < ring.day ? "#9aa39c" : "#d5dbda"} />;
            })}
            {[1, 7, 14, 21].map((j) => {
              const q = at(j - 0.5, R + 26);
              return (
                <text key={j} x={q.x} y={q.y} textAnchor="middle" dominantBaseline="middle" className="fill-slate text-[11px] font-semibold">
                  J{j}
                </text>
              );
            })}
            <line x1={tick.x} y1={tick.y} x2={today.x} y2={today.y} stroke="#182220" strokeWidth="2" />
            <circle cx={today.x} cy={today.y} r="9" fill="#182220" stroke="#fff" strokeWidth="3" />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-[36px] leading-none tracking-tight text-ink">J{ring.day}</b>
            <span className="text-xs text-slate">sur {ring.len} jours</span>
            <span className="mt-1.5 text-[13.5px] font-bold" style={{ color: now.color }}>
              {now.label}
            </span>
            <span className="text-xs text-ink-soft">règles dans {ring.nextIn} j</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {ring.phases.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setSel(p.key)}
              className={`grid grid-cols-[12px_1fr_auto] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${sel === p.key ? "bg-[#f4eff4]" : "hover:bg-paper-dim"}`}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
              <span className="min-w-0">
                <span className={`text-sm text-ink ${sel === p.key ? "font-bold" : "font-medium"}`}>
                  {p.label}
                  {p.key === ring.phaseNow && <span className="ml-1.5 rounded-full bg-ink px-1.5 py-px align-[1px] text-[10.5px] font-bold text-white">aujourd’hui</span>}
                </span>
                <span className="block text-xs text-slate">{p.dates}</span>
              </span>
              <span className="text-xs text-slate">
                J{p.from}
                {p.to > p.from ? `–J${p.to}` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 rounded-xl border-l-4 bg-[#f8f6f9] px-4 py-3" style={{ borderColor: s.color }}>
        <div className="flex flex-wrap items-baseline gap-2">
          <b className="text-[14.5px] text-ink">
            {s.label} · J{s.from}
            {s.to > s.from ? ` à J${s.to}` : ""}
          </b>
          <span className="flex-1" />
          <span className="text-xs text-slate">Ce cycle : {s.dates}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Forme", s.forme, 10],
            ["Forme physique", s.physique, 10],
            ["Sommeil", s.sommeil, 10],
          ].map(([l, v, m]) => (
            <div key={l as string}>
              <p className="text-xs text-slate">{l} moyenne</p>
              <p className="text-[17px] font-bold text-ink">
                {fmt(v as number | null)} <span className="text-xs font-medium text-slate">/ {m}</span>
              </p>
            </div>
          ))}
        </div>
        {s.compare && <p className="text-[13px] text-ink-soft">{s.compare}</p>}
        <p className="text-[13.5px] leading-relaxed text-ink">{s.tip}</p>
        <p className="text-[11.5px] text-slate">
          Moyennes des check-ins de {firstName} sur les 3 derniers cycles ({s.n} jour{s.n > 1 ? "s" : ""}).
        </p>
      </div>
    </div>
  );
}

export function HealthTab({
  athleteId,
  firstName,
  injuries,
  sports,
  cycle,
  ring,
  cycleShared,
  today,
}: {
  athleteId: string;
  firstName: string;
  injuries: InjuryView[];
  sports: { key: string; label: string }[];
  cycle: CycleSummary | null;
  ring: CycleRingView | null;
  cycleShared: boolean;
  today: string;
}) {
  const [form, setForm] = useState<{ edit: InjuryView | null; preset?: Partial<InjuryView> } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const active = injuries.filter((i) => !i.dateEnd);
  const past = injuries.filter((i) => i.dateEnd).sort((a, b) => b.dateEnd!.localeCompare(a.dateEnd!));

  return (
    <div className="flex flex-col gap-6">
      <TabHeader title="Santé" />
      <div className={`grid items-start gap-6 ${cycleShared ? "lg:grid-cols-[1.15fr_1fr]" : ""}`}>
        <Panel>
          <PanelTitle
            title="Blessures"
            hint={`${injuries.length} enregistrée${injuries.length > 1 ? "s" : ""}`}
            right={
              <button type="button" className={ghostBtn} onClick={() => setForm(form && !form.edit && !form.preset ? null : { edit: null })}>
                {form && !form.edit && !form.preset ? "Fermer" : "+ Déclarer une blessure"}
              </button>
            }
          />
          <div className="flex flex-col gap-3">
            {form && (
              <InjuryForm
                key={form.edit?.id ?? (form.preset ? "relapse" : "new")}
                athleteId={athleteId}
                injury={form.edit}
                preset={form.preset}
                sports={sports}
                today={today}
                onDone={() => setForm(null)}
              />
            )}
            {active.length === 0 ? (
              <p className="flex items-center gap-2.5 rounded-2xl bg-paper px-4 py-3 text-sm text-ink-soft">
                <span className="h-2 w-2 rounded-full bg-moss" />
                Aucune blessure en cours
              </p>
            ) : (
              active.map((i) => <ActiveInjury key={i.id} injury={i} sports={sports} today={today} onEdit={() => setForm({ edit: i })} />)
            )}
          </div>
          {past.length > 0 && (
            <>
              <p className="mb-1 mt-5 text-[15px] font-semibold text-ink">Antécédents</p>
              <ul className="flex flex-col">
                {past.map((i) => (
                  <PastInjury
                    key={i.id}
                    injury={i}
                    sports={sports}
                    open={open === i.id}
                    onToggle={() => setOpen(open === i.id ? null : i.id)}
                    onEdit={() => {
                      setOpen(null);
                      setForm({ edit: i });
                    }}
                    onRelapse={() => {
                      setOpen(null);
                      setForm({
                        edit: null,
                        preset: {
                          bodyPart: i.bodyPart ?? i.label,
                          side: i.side,
                          type: i.type,
                          pain: 3,
                          dateStart: today,
                          description: `Rechute · ${(i.type ?? "blessure").toLowerCase()} du ${frs(i.dateStart, true)}.`,
                          advice: i.advice,
                          impact: i.impact,
                        },
                      });
                    }}
                  />
                ))}
              </ul>
            </>
          )}
        </Panel>

        {cycleShared && (
          <Panel>
            <PanelTitle title="Cycle menstruel" hint={`partagé par ${firstName}`} />
            {ring ? <CycleRing ring={ring} firstName={firstName} /> : <p className="text-sm text-slate">Pas encore de début de règles renseigné.</p>}
            {cycle && (
              <>
                <div className="mt-4 flex flex-col">
                  {cycle.rows.map((r) => (
                    <Row key={r.label} label={r.label} value={r.value} />
                  ))}
                </div>
                {ring && ring.history.length > 1 && (
                  <div className="mt-4">
                    <p className={SEC}>Derniers cycles</p>
                    <ul className="mt-1">
                      {ring.history.map((h) => (
                        <li key={h.from} className="flex items-baseline justify-between border-t border-line py-1.5 text-[13.5px]">
                          <span className="text-ink-soft">{h.to ? `${frs(h.from)} → ${frs(h.to)}` : `Depuis le ${frs(h.from)}`}</span>
                          <span className="text-slate">{h.len ? `${h.len} jours` : `en cours · J${ring.day}`}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {cycle.insight && <p className="mt-4 rounded-2xl bg-[#f4eff4] px-4 py-3 text-sm text-ink">{cycle.insight}</p>}
              </>
            )}
            <p className="mt-4 text-xs text-slate">
              {firstName} peut arrêter le partage à tout moment. Seules les dates et ses check-ins sont partagés, pas ses notes.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
