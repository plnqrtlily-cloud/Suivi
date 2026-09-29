"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveZoneOverridesAction } from "@/lib/actions";
import {
  ZONE_FEEL,
  ZONE_NAMES,
  frDay,
  kmhFromPace,
  paceOf,
  pctLabels,
  rangeLabels,
  zoneOf,
  type Cuts,
  type ZoneKind,
  type ZoneSet,
} from "@/lib/training-zones";
import { Panel, ghostBtn } from "./tab-ui";

const ZONE_COLORS = ["#c5dcda", "#9fc2c1", "#5d8c8f", "#1d4a4f", "#e8896a"];
type Ref = "pma" | "vma" | "fc";
const KINDS: ZoneKind[] = ["hr", "pw", "pace"];

export interface ZoneActivity {
  minutes: number;
  hr?: number;
  power?: number;
  kmh?: number;
}

function hm(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

export function ZonesPanel({
  athleteId,
  auto,
  overrides,
  overriddenAt,
  source,
  refs,
  activities,
}: {
  athleteId: string;
  auto: ZoneSet;
  overrides: ZoneSet;
  overriddenAt: string | null;
  source: string;
  refs: { pma?: number; vma?: number; fcMax?: number };
  activities: ZoneActivity[];
}) {
  const router = useRouter();
  const zones: ZoneSet = { hr: overrides.hr ?? auto.hr, pw: overrides.pw ?? auto.pw, pace: overrides.pace ?? auto.pace };
  const refOptions: { value: Ref; label: string; ok: boolean }[] = [
    { value: "pma", label: "PMA", ok: !!refs.pma && !!zones.pw },
    { value: "vma", label: "VMA", ok: !!refs.vma && !!zones.pace },
    { value: "fc", label: "FC max", ok: !!refs.fcMax && !!zones.hr },
  ];
  const [ref, setRef] = useState<Ref>(refOptions.find((o) => o.ok)?.value ?? "pma");
  const [draft, setDraft] = useState<Record<ZoneKind, string[]> | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!zones.hr && !zones.pw && !zones.pace) return null;

  const toStrings = (z: ZoneSet): Record<ZoneKind, string[]> => ({
    hr: z.hr ? z.hr.map(String) : ["", "", "", ""],
    pw: z.pw ? z.pw.map(String) : ["", "", "", ""],
    pace: z.pace ? z.pace.map(paceOf) : ["", "", "", ""],
  });

  // ----- Référence et temps passé -----
  const refKind: ZoneKind = ref === "pma" ? "pw" : ref === "vma" ? "pace" : "hr";
  const refValue = ref === "pma" ? refs.pma : ref === "vma" ? refs.vma : refs.fcMax;
  const refCuts = zones[refKind];
  const pct = refCuts && refValue ? pctLabels(refCuts, refValue) : null;
  const time = [0, 0, 0, 0, 0];
  if (refCuts) {
    for (const a of activities) {
      const v = refKind === "pw" ? a.power : refKind === "pace" ? a.kmh : a.hr;
      if (v && a.minutes > 0) time[zoneOf(v, refCuts)] += a.minutes;
    }
  }
  const total = time.reduce((s, x) => s + x, 0);
  const maxT = Math.max(...time, 1);
  const low = total ? Math.round(((time[0] + time[1]) / total) * 100) : 0;
  const note =
    low >= 78
      ? "répartition conforme à une cible 80 / 20."
      : time[2] >= time[3] + time[4]
        ? "pour une cible 80 / 20 : un peu trop de tempo (Z3) ce mois-ci."
        : "pour une cible 80 / 20 : beaucoup de haute intensité (Z4-Z5) ce mois-ci.";
  const refWord = ref === "pma" ? "puissance" : ref === "vma" ? "allure" : "FC";

  // ----- Modification des bornes -----
  function parseDraft(d: Record<ZoneKind, string[]>): ZoneSet | string {
    const out: ZoneSet = { hr: null, pw: null, pace: null };
    for (const k of KINDS) {
      const vals = d[k];
      if (vals.every((v) => !v.trim())) continue;
      const nums = vals.map((v) => (k === "pace" ? kmhFromPace(v) : Number(v.replace(",", "."))));
      if (nums.some((n) => !n || !(n > 0))) return k === "pace" ? "Allures au format 4'30." : "Chaque borne doit être un nombre.";
      out[k] = nums as Cuts;
    }
    return out;
  }
  function save() {
    if (!draft) return;
    const parsed = parseDraft(draft);
    if (typeof parsed === "string") {
      setError(parsed);
      return;
    }
    const same = (a: Cuts | null, b: Cuts | null) => JSON.stringify(a) === JSON.stringify(b);
    const payload = {
      hr: same(parsed.hr, auto.hr) ? null : parsed.hr,
      pw: same(parsed.pw, auto.pw) ? null : parsed.pw,
      pace: parsed.pace && auto.pace && parsed.pace.every((v, i) => Math.abs(v - auto.pace![i]) < 0.15) ? null : parsed.pace,
    };
    setError("");
    start(async () => {
      const r = await saveZoneOverridesAction(athleteId, payload.hr || payload.pw || payload.pace ? payload : null);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  const hasOverride = !!(overrides.hr || overrides.pw || overrides.pace);
  const hint = hasOverride && overriddenAt ? `Ajustées à la main le ${frDay(overriddenAt)}` : source;
  const labels = {
    hr: zones.hr ? rangeLabels("hr", zones.hr) : null,
    pw: zones.pw ? rangeLabels("pw", zones.pw) : null,
    pace: zones.pace ? rangeLabels("pace", zones.pace) : null,
  };
  const th = "pb-2 pr-4 text-left text-[12.5px] font-semibold text-ink-soft whitespace-nowrap";
  const td = "border-t border-line py-2.5 pr-4 text-sm whitespace-nowrap";
  const inputCls = "w-[68px] rounded-lg border border-line bg-white px-2 py-1 text-[13.5px] font-semibold text-ink outline-none focus:border-moss";

  const cell = (k: ZoneKind, i: number) => {
    if (draft) {
      if (i === 4) {
        const prev = draft[k][3];
        return <span className="text-slate">{prev ? (k === "pace" ? `< ${prev}` : `≥ ${prev}`) : "—"}</span>;
      }
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-xs text-slate">{k === "pace" ? ">" : "<"}</span>
          <input
            aria-label={`Borne Z${i + 1} ${k}`}
            value={draft[k][i]}
            onChange={(e) => setDraft({ ...draft, [k]: draft[k].map((v, j) => (j === i ? e.target.value : v)) })}
            className={inputCls}
          />
        </span>
      );
    }
    const l = labels[k];
    return <b className="font-semibold text-ink">{l ? l[i] : "—"}</b>;
  };

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-[17px] font-bold tracking-tight text-ink">Zones d&apos;entraînement</h3>
        {hint && <span className="text-[13px] text-slate">{hint}</span>}
        <span className="flex-1" />
        {!draft && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate">Référence</span>
            <div className="flex rounded-full bg-paper-dim p-[3px]">
              {refOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={!o.ok}
                  onClick={() => setRef(o.value)}
                  title={o.ok ? undefined : "Aucune valeur de référence enregistrée"}
                  className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors disabled:opacity-40 ${ref === o.value ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!draft ? (
          <button type="button" className={ghostBtn} onClick={() => setDraft(toStrings(zones))}>
            Modifier
          </button>
        ) : null}
      </div>
      {draft && (
        <p className="-mt-2 mb-3 text-[13px] text-ink-soft">
          Indiquez la borne haute de chaque zone (allure : la plus lente), Z5 commence à la borne de Z4. Laissez une colonne vide pour la calculer automatiquement.
        </p>
      )}

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr>
              <th className={th}>Zone</th>
              <th className={th}>FC (bpm)</th>
              <th className={th}>Puissance (W)</th>
              <th className={th}>Allure (/km)</th>
              {!draft && (
                <th className={`${th} text-moss-dark`}>
                  % {ref === "pma" ? `PMA${refs.pma ? ` (${refs.pma} W)` : ""}` : ref === "vma" ? `VMA${refs.vma ? ` (${String(refs.vma).replace(".", ",")} km/h)` : ""}` : `FC max${refs.fcMax ? ` (${refs.fcMax})` : ""}`}
                </th>
              )}
              {!draft && <th className={th}>Sensations</th>}
              {!draft && <th className={`${th} w-[240px]`}>Temps passé · 4 sem. · {refWord}</th>}
            </tr>
          </thead>
          <tbody>
            {ZONE_NAMES.map((n, i) => (
              <tr key={n}>
                <td className={td}>
                  <span className="inline-flex items-center gap-2.5">
                    <span className="h-[22px] w-2 rounded-[3px]" style={{ background: ZONE_COLORS[i] }} />
                    <b className="font-semibold text-ink">Z{i + 1}</b>
                    <span className="text-ink-soft">{n}</span>
                  </span>
                </td>
                <td className={td}>{cell("hr", i)}</td>
                <td className={td}>{cell("pw", i)}</td>
                <td className={td}>{cell("pace", i)}</td>
                {!draft && <td className={`${td} font-semibold text-moss-dark`}>{pct ? pct[i] : "—"}</td>}
                {!draft && <td className={`${td} text-ink-soft`}>{ZONE_FEEL[i]}</td>}
                {!draft && (
                  <td className={`${td} pr-0`}>
                    {total ? (
                      <span className="flex items-center gap-3">
                        <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper-dim">
                          <span className="block h-full rounded-full" style={{ width: `${(time[i] / maxT) * 100}%`, background: ZONE_COLORS[i] }} />
                        </span>
                        <span className="w-[92px] text-right">
                          <b className="font-semibold text-ink">{time[i] ? hm(time[i]) : "0"}</b>{" "}
                          <span className="text-slate">{Math.round((time[i] / total) * 100)} %</span>
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-full bg-moss px-4 py-2 text-[13px] font-semibold text-white hover:bg-moss-dark disabled:opacity-50"
          >
            {pending ? "…" : "Enregistrer"}
          </button>
          <button type="button" onClick={() => setDraft(toStrings(auto))} className={ghostBtn}>
            Recalculer depuis les tests
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setError("");
            }}
            className="text-[13px] font-semibold text-slate hover:text-ink"
          >
            Annuler
          </button>
          {error && <span className="text-sm text-clay">{error}</span>}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3 text-[13.5px]">
          {total ? (
            <span className="text-ink-soft">
              <b className="font-semibold text-ink">{low} % sous le seuil 1</b> {note}
            </span>
          ) : (
            <span className="text-slate">
              Aucune activité avec {ref === "pma" ? "puissance" : ref === "vma" ? "allure de course" : "fréquence cardiaque"} sur les 4 dernières semaines.
            </span>
          )}
          {total > 0 && <span className="text-xs text-slate">{hm(total)} d’entraînement sur 4 semaines</span>}
        </div>
      )}
    </Panel>
  );
}
