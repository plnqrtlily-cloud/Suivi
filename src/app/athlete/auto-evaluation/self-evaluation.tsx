"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSelfEvaluationAction } from "@/lib/actions";
import { PROFILE_DOMAINS, LEVEL_LABELS } from "@/lib/performance-profile";

const STAR = "M10 1.8l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z";
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function SelfEvaluation({ qualities, lastDate }: { qualities: { id: string; domain: string; name: string; level: number }[]; lastDate: string | null }) {
  const router = useRouter();
  const [levels, setLevels] = useState<Record<string, number>>(Object.fromEntries(qualities.map((q) => [q.id, q.level])));
  const [, start] = useTransition();
  const done = qualities.filter((q) => levels[q.id] > 0).length;

  function pick(id: string, i: number) {
    setLevels((l) => ({ ...l, [id]: i }));
    start(async () => {
      await setSelfEvaluationAction(id, i);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-3.5">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-dim">
          <div className="h-full rounded-full bg-moss transition-all" style={{ width: `${(done / qualities.length) * 100}%` }} />
        </div>
        <span className="text-sm font-semibold text-ink">
          {done} / {qualities.length}
        </span>
        {lastDate && (
          <span className="text-xs text-slate">
            mise à jour le {Number(lastDate.slice(8, 10))} {MONTHS[Number(lastDate.slice(5, 7)) - 1]}
          </span>
        )}
      </div>
      {PROFILE_DOMAINS.map((d) => {
        const xs = qualities.filter((q) => q.domain === d.key);
        if (!xs.length) return null;
        return (
          <section key={d.key} className="rounded-2xl bg-white p-5">
            <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
              <i className="h-3 w-3 rounded-full" style={{ background: d.color }} />
              {d.label}
            </h2>
            <ul>
              {xs.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0">
                  <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">{q.name}</span>
                  <span className="flex items-center">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button key={i} type="button" onClick={() => pick(q.id, i)} aria-label={`${i} sur 5 · ${LEVEL_LABELS[i]}`} title={LEVEL_LABELS[i]} className="flex p-1">
                        <svg width="26" height="26" viewBox="0 0 20 20">
                          <path d={STAR} fill={i <= levels[q.id] ? "#6f95b8" : "#dfe5e3"} />
                        </svg>
                      </button>
                    ))}
                  </span>
                  <span className="w-20 text-right text-sm text-slate">{levels[q.id] ? LEVEL_LABELS[levels[q.id]] : "—"}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-center text-sm text-slate">Chaque note est enregistrée dès que tu cliques. Ton coach la voit sur ton profil.</p>
    </div>
  );
}
