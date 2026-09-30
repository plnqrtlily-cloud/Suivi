"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPerformanceQualityAction,
  seedPerformanceProfileAction,
  updatePerformanceQualityAction,
  deletePerformanceQualityAction,
  newPerformanceEvaluationAction,
  requestSelfEvaluationAction,
  deleteCoachProfileQualityAction,
} from "@/lib/actions";
import type { PerformanceQuality, CoachProfileQuality } from "@/lib/queries";
import { PROFILE_DOMAINS, QUALITY_LIBRARY, LEVEL_LABELS, IMPORTANCE_LABELS, ZONE_INFO, qualityZone, type ProfileDomain } from "@/lib/performance-profile";
import { Panel, ghostBtn, primaryBtn, fieldClass } from "./tab-ui";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const frd = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]}`;
};
const num = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");
const STAR = "M10 1.8l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z";

function Stars({ n, size = 15, color = "#e0a526", onPick, label = "" }: { n: number; size?: number; color?: string; onPick?: (i: number) => void; label?: string }) {
  return (
    <span className="inline-flex items-center">
      {[1, 2, 3, 4, 5].map((i) => {
        const svg = (
          <svg width={size} height={size} viewBox="0 0 20 20">
            <path d={STAR} fill={i <= n ? color : "#dfe5e3"} />
          </svg>
        );
        return onPick ? (
          <button key={i} type="button" onClick={() => onPick(i)} aria-label={`${label}${i} / 5 · ${LEVEL_LABELS[i]}`} title={`${i} / 5 · ${LEVEL_LABELS[i]}`} className="flex px-px">
            {svg}
          </button>
        ) : (
          <span key={i} className="flex px-px">
            {svg}
          </span>
        );
      })}
    </span>
  );
}

type Q = PerformanceQuality & { zone: ReturnType<typeof qualityZone> };

function Radar({ qs, dom, onDom, showAth, showPrev }: { qs: Q[]; dom: string | null; onDom: (d: ProfileDomain) => void; showAth: boolean; showPrev: boolean }) {
  const RC = 250;
  const RR = 190;
  const N = PROFILE_DOMAINS.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const P = (i: number, v: number) => [Math.round((RC + Math.cos(ang(i)) * RR * (v / 5)) * 100) / 100, Math.round((RC + Math.sin(ang(i)) * RR * (v / 5)) * 100) / 100];
  const avg = (d: string, k: "level" | "athlete_level" | "prev_level") => {
    const xs = qs.filter((x) => x.domain === d && (x[k] ?? 0) > 0).map((x) => x[k] as number);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  const poly = (k: "level" | "athlete_level" | "prev_level") => PROFILE_DOMAINS.map((d, i) => P(i, avg(d.key, k)).map((v) => v.toFixed(1)).join(",")).join(" ");
  const hasAth = qs.some((x) => x.athlete_level);
  const hasPrev = qs.some((x) => x.prev_level && x.prev_level !== x.level);
  return (
    <svg viewBox="-150 -40 800 580" className="mx-auto block max-h-[540px] w-full overflow-visible">
      {[1, 2, 3, 4, 5].map((n) => {
        const lp = P(0, n);
        return (
          <g key={n}>
            <polygon points={PROFILE_DOMAINS.map((d, i) => P(i, n).map((v) => v.toFixed(1)).join(",")).join(" ")} fill="none" stroke="#e6eae9" />
            <text x={lp[0] + 6} y={lp[1] + 4} className="fill-[#9aa39c] text-[11px]">
              {n}
            </text>
          </g>
        );
      })}
      {PROFILE_DOMAINS.map((d, i) => {
        const e = P(i, 5);
        return <line key={d.key} x1={RC} y1={RC} x2={e[0]} y2={e[1]} stroke="#e6eae9" />;
      })}
      {showPrev && hasPrev && <polygon points={poly("prev_level")} fill="none" stroke="#b4bcb9" strokeWidth="2" strokeDasharray="6 5" />}
      {showAth && hasAth && <polygon points={poly("athlete_level")} fill="rgba(111,149,184,0.08)" stroke="#6f95b8" strokeWidth="2.5" />}
      <polygon points={poly("level")} fill="rgba(27,75,79,0.14)" stroke="#1b4b4f" strokeWidth="3" strokeLinejoin="round" />
      {PROFILE_DOMAINS.map((d, i) => {
        const v = avg(d.key, "level");
        const pv = avg(d.key, "prev_level");
        const dv = pv ? Math.round((v - pv) * 10) / 10 : 0;
        const vp = P(i, v);
        const c = Math.cos(ang(i));
        const sn = Math.sin(ang(i));
        const on = dom === d.key;
        return (
          <g key={d.key} onClick={() => onDom(d.key)} className="cursor-pointer">
            {v > 0 && <circle cx={vp[0]} cy={vp[1]} r={on ? 9 : 6} fill={d.color} stroke="#fff" strokeWidth="2.5" />}
            <text
              x={Math.round(RC + c * (RR + 22))}
              y={Math.round(RC + sn * (RR + 22) + (sn < -0.9 ? -10 : sn > 0.9 ? 10 : 0))}
              textAnchor={Math.abs(c) < 0.2 ? "middle" : c > 0 ? "start" : "end"}
              dominantBaseline="middle"
            >
              <tspan className="text-[17px] font-extrabold" fill={on ? d.color : "#182220"}>
                {d.label}
              </tspan>
              <tspan dx="8" className="text-[17px] font-bold" fill={d.color}>
                {v ? num(v) : "—"}
              </tspan>
              {dv !== 0 && (
                <tspan dx="6" className="text-[13px] font-bold" fill={dv > 0 ? "#2f6b4f" : "#a4492a"}>
                  {dv > 0 ? `↗ +${num(dv)}` : `↘ −${num(-dv)}`}
                </tspan>
              )}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function QualityRow({ q, rank, prevDate, athleteName }: { q: Q; rank: number | null; prevDate: string | null; athleteName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(q.plan ?? "");
  const [pending, start] = useTransition();
  const z = ZONE_INFO[q.zone];
  const dl = q.prev_level && q.level ? q.level - q.prev_level : 0;
  const gap = q.athlete_level && q.level && Math.abs(q.level - q.athlete_level) >= 2;
  const save = (patch: { level?: number; importance?: number; plan?: string }) =>
    start(async () => {
      await updatePerformanceQualityAction(q.id, patch);
      router.refresh();
    });
  return (
    <div className={`flex flex-col rounded-lg border-t border-line ${open ? "bg-paper" : ""}`}>
      <button type="button" onClick={() => setOpen(!open)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 px-2.5 py-2.5 text-left">
        <span className="flex min-w-0 items-center gap-1.5">
          {rank !== null && (
            <b title={`Priorité ${rank}`} className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#a4492a] text-[11px] text-white">
              {rank}
            </b>
          )}
          <span className="truncate text-sm font-semibold text-ink">{q.name}</span>
          {dl !== 0 && <span className={`text-[13px] font-extrabold ${dl > 0 ? "text-[#2f6b4f]" : "text-[#a4492a]"}`}>{dl > 0 ? "↗" : "↘"}</span>}
          {gap && <span className="rounded-full bg-[#e6eef6] px-1.5 text-[10.5px] font-extrabold text-[#2f5f8a]">à discuter</span>}
        </span>
        <Stars n={q.level} />
        <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: z.color }}>
          <i className="h-[7px] w-[7px] rounded-full" style={{ background: z.color }} />
          {z.label}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 px-2.5 pb-3">
          <p className="text-[12.5px] text-slate">{z.text}</p>
          <div className="grid grid-cols-[78px_auto_minmax(0,1fr)] items-center gap-2">
            <span className="text-[12.5px] font-semibold text-slate">Vous</span>
            <Stars n={q.level} size={20} onPick={(i) => save({ level: i })} label="Votre évaluation : " />
            <span className="text-[12.5px] font-semibold text-ink">
              {LEVEL_LABELS[q.level]}
              {q.prev_level && prevDate ? (
                <span className="font-medium text-slate"> · {dl === 0 ? `stable depuis le ${frd(prevDate)}` : `${dl > 0 ? "+" : "−"}${Math.abs(dl)} depuis le ${frd(prevDate)}`}</span>
              ) : null}
            </span>
            <span className="text-[12.5px] font-semibold text-slate">{athleteName}</span>
            {q.athlete_level ? <Stars n={q.athlete_level} size={16} color="#6f95b8" /> : <span className="text-[12.5px] text-slate">—</span>}
            <span className="text-[12.5px] text-ink-soft">{q.athlete_level ? LEVEL_LABELS[q.athlete_level] : "pas d’auto-évaluation"}</span>
            <span className="text-[12.5px] font-semibold text-slate">Importance</span>
            <div className="col-span-2 flex justify-self-start rounded-full bg-paper-dim p-[3px]">
              {[1, 2, 3].map((i) => (
                <button
                  key={i}
                  type="button"
                  disabled={pending}
                  onClick={() => save({ importance: i })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${q.importance === i ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
                >
                  {IMPORTANCE_LABELS[i]}
                </button>
              ))}
            </div>
          </div>
          {gap && (
            <p className="rounded-lg bg-[#e6eef6] px-2.5 py-2 text-[12.5px] text-[#2f5f8a]">
              {athleteName} se voit {q.athlete_level! < q.level ? "moins" : "plus"} fort(e) que vous : à aborder à votre prochain échange.
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate">{q.zone === "work" ? "Plan de travail" : q.zone === "keep" ? "Rappel pour le maintenir" : "Note"}</span>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              onBlur={() => plan !== (q.plan ?? "") && save({ plan })}
              rows={2}
              placeholder={q.zone === "work" ? "Exercices, séances, échéance…" : "Fréquence du rappel, remarques…"}
              className={`${fieldClass} resize-y`}
            />
          </label>
          <div className="flex">
            <span className="flex-1" />
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await deletePerformanceQualityAction(q.id);
                  router.refresh();
                })
              }
              className="text-[13px] font-semibold text-clay hover:underline"
            >
              Retirer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Bibliothèque du coach pour ce domaine : ses qualités créées, retirables
// (sans effet sur les profils où elles ont déjà été ajoutées).
function MyQualities({ items }: { items: CoachProfileQuality[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-slate">Mes qualités :</span>
      {items.map((q) => (
        <span key={q.id} className="flex items-center gap-0.5 rounded-full border border-line bg-white py-0.5 pl-2.5 pr-1 text-xs text-ink">
          {q.name}
          <button
            type="button"
            disabled={pending}
            aria-label={`Retirer « ${q.name} » de mes qualités`}
            title="Retirer de mes qualités (reste dans les profils où elle est déjà)"
            onClick={() =>
              start(async () => {
                await deleteCoachProfileQualityAction(q.id);
                router.refresh();
              })
            }
            className="flex h-5 w-5 items-center justify-center rounded-full text-sm leading-none text-slate hover:bg-paper-dim hover:text-clay"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

function AddQuality({
  athleteId,
  domain,
  used,
  mine,
  onDone,
}: {
  athleteId: string;
  domain: ProfileDomain;
  used: string[];
  mine: CoachProfileQuality[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [other, setOther] = useState("");
  const [keep, setKeep] = useState(true);
  const [level, setLevel] = useState(0);
  const [imp, setImp] = useState(2);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const isUsed = (n: string) => used.some((u) => u.toLowerCase() === n.toLowerCase());
  const free = QUALITY_LIBRARY[domain].filter((n) => !isUsed(n));
  const myFree = mine.filter((q) => !isUsed(q.name));
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-paper p-3">
      <select value={name} onChange={(e) => setName(e.target.value)} className={fieldClass}>
        <option value="">Choisir une qualité…</option>
        {myFree.length > 0 && (
          <optgroup label="Mes qualités">
            {myFree.map((q) => (
              <option key={q.id} value={q.name}>
                {q.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Qualités proposées">
          {free.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </optgroup>
        <option value="__autre">Créer ma qualité…</option>
      </select>
      {name === "__autre" && (
        <>
          <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={80} autoFocus placeholder="Nom de la qualité" className={fieldClass} />
          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            La garder dans mes qualités, pour tous mes athlètes
          </label>
        </>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <Stars n={level} size={18} onPick={setLevel} label="Niveau " />
        <select value={imp} onChange={(e) => setImp(Number(e.target.value))} className="rounded-lg border border-line bg-white px-2 py-1 text-[13px]">
          {[3, 2, 1].map((i) => (
            <option key={i} value={i}>
              Importance {IMPORTANCE_LABELS[i].toLowerCase()}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <button
          type="button"
          disabled={pending}
          className={primaryBtn}
          onClick={() => {
            const n = name === "__autre" ? other.trim() : name;
            if (!n) return setError("Choisissez ou nommez la qualité.");
            setError("");
            start(async () => {
              const r = await addPerformanceQualityAction(athleteId, domain, n, level, imp, name === "__autre" && keep);
              if ("error" in r) return setError(r.error);
              onDone();
              router.refresh();
            });
          }}
        >
          Ajouter
        </button>
      </div>
      {error && <p className="text-sm text-clay">{error}</p>}
      <MyQualities items={mine} />
    </div>
  );
}

export function PerformanceProfile({
  athleteId,
  firstName,
  qualities,
  evalDate,
  prevEvalDate,
  selfRequestedAt,
  selfEvalDate,
  coachQualities,
}: {
  athleteId: string;
  firstName: string;
  qualities: PerformanceQuality[];
  evalDate: string | null;
  prevEvalDate: string | null;
  selfRequestedAt: string | null;
  selfEvalDate: string | null;
  coachQualities: CoachProfileQuality[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dom, setDom] = useState<ProfileDomain | null>(null);
  const [showAth, setShowAth] = useState(true);
  const [showPrev, setShowPrev] = useState(true);
  const [adding, setAdding] = useState<ProfileDomain | null>(null);
  const qs: Q[] = qualities.map((q) => ({ ...q, zone: qualityZone(q.level, q.importance) }));
  const rank = qs
    .filter((x) => x.zone === "work")
    .sort((a, b) => b.importance - a.importance || a.level - b.level)
    .map((x) => x.id);
  const order = { work: 0, todo: 1, keep: 2, ent: 3, sec: 4 };
  const toggleDom = (d: ProfileDomain) => setDom((cur) => (cur === d ? null : d));
  // Demande en attente : envoyée et pas de saisie de l'athlète depuis.
  const waiting = !!selfRequestedAt && (!selfEvalDate || selfEvalDate < selfRequestedAt);

  if (qs.length === 0) {
    return (
      <Panel>
        <h3 className="text-[17px] font-bold tracking-tight text-ink">Profil de performance</h3>
        <p className="mt-2 max-w-[640px] text-sm text-ink-soft">
          Évaluez les qualités de {firstName} dans 6 domaines (physique, psychique, psychomoteur, tactique, nutrition, hygiène de vie) : leur niveau et leur importance pour
          l’objectif indiquent ce qu’il faut travailler, maintenir ou laisser au second plan.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className={primaryBtn}
            onClick={() =>
              start(async () => {
                await seedPerformanceProfileAction(athleteId);
                router.refresh();
              })
            }
          >
            Partir d’une base de 18 qualités
          </button>
          <button type="button" className={ghostBtn} onClick={() => setAdding("phy")}>
            Ajouter une qualité
          </button>
        </div>
        {adding && (
          <div className="mt-3 max-w-[520px]">
            <select value={adding} onChange={(e) => setAdding(e.target.value as ProfileDomain)} className={`${fieldClass} mb-2`}>
              {PROFILE_DOMAINS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
            <AddQuality athleteId={athleteId} domain={adding} used={[]} mine={coachQualities.filter((q) => q.domain === adding)} onDone={() => setAdding(null)} />
          </div>
        )}
      </Panel>
    );
  }

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-[17px] font-bold tracking-tight text-ink">Profil de performance</h3>
          {evalDate && (
            <span className="text-[13px] text-slate">
              Évaluation du {frd(evalDate)}
              {prevEvalDate ? ` · comparée au ${frd(prevEvalDate)}` : ""}
            </span>
          )}
          {selfEvalDate && <span className="text-[13px] text-slate">· auto-évaluation de {firstName} du {frd(selfEvalDate)}</span>}
          <span className="flex-1" />
          <button
            type="button"
            disabled={pending || waiting}
            className={ghostBtn}
            title={`${firstName} reçoit une notification et se note sur chaque qualité depuis son profil`}
            onClick={() =>
              start(async () => {
                await requestSelfEvaluationAction(athleteId);
                router.refresh();
              })
            }
          >
            {waiting ? `Demande envoyée le ${frd(selfRequestedAt!)}` : `Demander son auto-évaluation à ${firstName}`}
          </button>
          <button
            type="button"
            disabled={pending}
            className={primaryBtn}
            title="Les niveaux actuels deviennent la référence pour mesurer l’évolution"
            onClick={() =>
              start(async () => {
                await newPerformanceEvaluationAction(athleteId);
                router.refresh();
              })
            }
          >
            Nouvelle évaluation
          </button>
        </div>
        <div className="mt-2 grid items-center gap-5 lg:grid-cols-[180px_minmax(0,1fr)_200px]">
          <span className="hidden lg:block" />
          <Radar qs={qs} dom={dom} onDom={toggleDom} showAth={showAth} showPrev={showPrev} />
          <div className="flex flex-col gap-2">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate">Afficher</p>
            <span className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-semibold text-ink">
              <span style={{ display: "inline-block", width: 20, borderTop: "3px solid #1b4b4f" }} />
              Votre évaluation
            </span>
            {[
              { on: showAth, set: setShowAth, l: firstName, style: "3px solid #6f95b8" },
              { on: showPrev, set: setShowPrev, l: prevEvalDate ? `Évaluation du ${frd(prevEvalDate)}` : "Évaluation précédente", style: "3px dashed #b4bcb9" },
            ].map((t) => (
              <button
                key={t.l}
                type="button"
                onClick={() => t.set(!t.on)}
                className={`flex items-center gap-2 rounded-xl border border-line px-2.5 py-1.5 text-left text-[13px] font-semibold text-ink ${t.on ? "bg-white" : "opacity-45"}`}
              >
                <span style={{ display: "inline-block", width: 20, borderTop: t.style }} />
                {t.l}
              </button>
            ))}
            <p className="mt-1 text-xs leading-snug text-slate">{dom ? "Cliquez à nouveau sur le domaine pour tout afficher." : "Cliquez sur un domaine pour le mettre en avant."}</p>
          </div>
        </div>
      </Panel>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline gap-2.5 px-1">
          <h3 className="text-[17px] font-bold tracking-tight text-ink">Détail par domaine</h3>
          <span className="text-[13px] text-slate">Cliquez sur une qualité pour la noter et écrire son plan · les numéros 1 à 5 sont les priorités</span>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PROFILE_DOMAINS.map((d) => {
            const xs = qs
              .filter((x) => x.domain === d.key)
              .sort((a, b) => order[a.zone] - order[b.zone] || (a.zone === "work" ? rank.indexOf(a.id) - rank.indexOf(b.id) : b.level - a.level));
            const rated = xs.filter((x) => x.level > 0);
            const v = rated.length ? rated.reduce((a, x) => a + x.level, 0) / rated.length : 0;
            const withPrev = rated.filter((x) => x.prev_level);
            const pv = withPrev.length ? withPrev.reduce((a, x) => a + (x.prev_level ?? 0), 0) / withPrev.length : 0;
            const dv = pv ? Math.round((withPrev.reduce((a, x) => a + x.level, 0) / withPrev.length - pv) * 10) / 10 : 0;
            const nWork = xs.filter((x) => x.zone === "work").length;
            const on = dom === d.key;
            return (
              <div
                key={d.key}
                className="flex flex-col gap-1.5 rounded-2xl border bg-white p-4 pb-2.5 transition-opacity"
                style={{ borderColor: on ? d.color : "var(--color-line, #e3e8e6)", borderWidth: on ? 2 : 1, opacity: dom && !on ? 0.55 : 1, boxShadow: on ? "0 6px 18px rgba(24,34,32,0.10)" : "none" }}
              >
                <div className="flex items-center gap-2.5">
                  <i className="h-3 w-3 rounded-full" style={{ background: d.color }} />
                  <b className="text-base text-ink">{d.label}</b>
                  <span className="flex-1" />
                  <b className="text-[22px] tracking-tight" style={{ color: d.color }}>
                    {v ? num(v) : "—"}
                  </b>
                  <span className="text-xs text-slate">/5</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-paper-dim">
                  <div className="h-full rounded" style={{ width: `${(v / 5) * 100}%`, background: d.color }} />
                </div>
                <div className="mb-1 flex items-center gap-2 text-[12.5px]">
                  <span className={`font-bold ${nWork ? "text-[#a4492a]" : "text-[#2f6b4f]"}`}>{xs.length === 0 ? "Aucune qualité" : nWork ? `${nWork} à travailler` : "Tout est au niveau"}</span>
                  <span className="flex-1" />
                  {dv !== 0 && prevEvalDate && (
                    <>
                      <span className={`font-bold ${dv > 0 ? "text-[#2f6b4f]" : "text-[#a4492a]"}`}>{dv > 0 ? `↗ +${num(dv)}` : `↘ −${num(-dv)}`}</span>
                      <span className="text-slate">depuis le {frd(prevEvalDate)}</span>
                    </>
                  )}
                </div>
                {xs.map((x) => {
                  const r = rank.indexOf(x.id);
                  return <QualityRow key={x.id} q={x} rank={r >= 0 && r < 5 ? r + 1 : null} prevDate={prevEvalDate} athleteName={firstName} />;
                })}
                {adding === d.key && <AddQuality athleteId={athleteId} domain={d.key} used={xs.map((x) => x.name)} mine={coachQualities.filter((q) => q.domain === d.key)} onDone={() => setAdding(null)} />}
                <button type="button" onClick={() => setAdding(adding === d.key ? null : d.key)} className="self-start px-0.5 pt-2 text-[12.5px] font-bold text-moss-dark">
                  {adding === d.key ? "Annuler" : "+ Ajouter une qualité"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
