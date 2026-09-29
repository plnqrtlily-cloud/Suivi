"use client";

import { useState } from "react";
import Link from "next/link";
import type { AttentionItem, LoadWeek, OverviewStat } from "@/lib/athlete-overview";
import { Panel, PanelTitle, Segmented, TabHeader, ghostBtn, linkBtn } from "./tab-ui";

const TONE: Record<AttentionItem["tone"], string> = {
  alert: "#a4492a",
  warn: "#e8896a",
  info: "#9aa39c",
};

function fmtMin(m: number) {
  const r = Math.round(m);
  if (r < 60) return `${r} min`;
  return `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, "0")}`;
}
const fmtN = (n: number) => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ");

function Attention({ items }: { items: AttentionItem[] }) {
  return (
    <Panel>
      <PanelTitle
        title="À regarder"
        right={<span className="text-[13px] text-slate">{items.length ? `${items.length} point${items.length > 1 ? "s" : ""}` : ""}</span>}
      />
      {items.length === 0 ? (
        <p className="text-sm text-slate">Rien de particulier : la semaine se déroule comme prévu.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((it, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
              <span className="w-[3px] self-stretch rounded-full" style={{ background: TONE[it.tone] }} />
              <div className="min-w-0 flex-1 basis-[220px]">
                <p className="text-[15px] font-semibold text-ink">{it.title}</p>
                {it.text && <p className="text-[13px] text-ink-soft">{it.text}</p>}
              </div>
              {it.action && (
                <Link href={it.action.href} scroll={false} className={`${ghostBtn} shrink-0`}>
                  {it.action.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function LoadChart({ weeks, stats }: { weeks: LoadWeek[]; stats: OverviewStat[] }) {
  const [range, setRange] = useState<"8" | "26">("8");
  const shown = range === "8" ? weeks.slice(-9) : weeks;
  const current = shown.find((w) => w.isCurrent) ?? shown[shown.length - 1];
  const [sel, setSel] = useState<string | null>(null);
  const selected = shown.find((w) => w.weekStart === sel) ?? current;

  const max = Math.max(1, ...shown.map((w) => Math.max(w.load, w.plannedLoad)));
  const H = 190;
  const n = shown.length;
  const slot = 100 / n;
  const formePts = shown
    .map((w, i) => (w.forme === null ? null : `${(i + 0.5) * slot},${H - (w.forme / 10) * H * 0.95}`))
    .filter(Boolean)
    .join(" ");
  const dense = n > 12;

  return (
    <Panel>
      <PanelTitle
        title="Charge et forme"
        right={
          <>
            <span className="hidden items-center gap-4 text-[13px] text-ink-soft md:flex">
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-[#1d4a4f]" />
                Charge réalisée
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-[#c5dcda]" />
                Prévue
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-[2px] w-3 bg-gold-light" />
                Forme moyenne
              </span>
            </span>
            <Segmented
              value={range}
              onChange={(v) => {
                setRange(v);
                setSel(null);
              }}
              options={[
                { value: "8", label: "8 semaines" },
                { value: "26", label: "6 mois" },
              ]}
            />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <div className="relative" style={{ height: H }}>
            <div className="absolute inset-0 flex items-end">
              {shown.map((w) => {
                const planned = (w.plannedLoad / max) * 100;
                const real = (w.load / max) * 100;
                const isSel = w.weekStart === selected.weekStart;
                return (
                  <button
                    key={w.weekStart}
                    type="button"
                    onClick={() => setSel(w.weekStart)}
                    aria-label={`Semaine ${w.number}`}
                    className={`flex h-full min-w-0 flex-1 items-end justify-center rounded-t-lg transition-colors ${
                      isSel ? "bg-paper-dim" : "hover:bg-paper-dim/60"
                    }`}
                  >
                    <span className={`relative block ${dense ? "w-[70%]" : "w-[62%]"}`} style={{ height: `${Math.max(planned, real)}%` }}>
                      <span
                        className="absolute inset-x-0 bottom-0 rounded-t-md bg-[#c5dcda] transition-[height] duration-500"
                        style={{ height: `${Math.max(planned, real) ? (planned / Math.max(planned, real)) * 100 : 0}%` }}
                      />
                      {!w.isFuture && (
                        <span
                          className="absolute inset-x-0 bottom-0 rounded-t-md bg-[#1d4a4f] transition-[height] duration-500"
                          style={{ height: `${Math.max(planned, real) ? (real / Math.max(planned, real)) * 100 : 0}%` }}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {formePts && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                viewBox={`0 0 100 ${H}`}
                preserveAspectRatio="none"
              >
                <polyline points={formePts} fill="none" stroke="#e8896a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>
          <div className="mt-2 flex border-t border-line pt-2">
            {shown.map((w, i) => (
              <div key={w.weekStart} className="min-w-0 flex-1 text-center leading-tight">
                {(!dense || i % 3 === 0 || w.isCurrent) && (
                  <>
                    <p className={`text-xs font-semibold ${w.isCurrent ? "text-ink" : "text-ink-soft"}`}>S{w.number}</p>
                    {!dense && <p className="truncate px-1 text-[11px] text-slate">{w.period ?? " "}</p>}
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-ink-soft">
            <b className="text-ink">
              Semaine {selected.number}
              {selected.period ? ` · ${selected.period}` : ""}
            </b>{" "}
            —{" "}
            {selected.isFuture
              ? `${fmtN(selected.plannedLoad)} UA prévues · ${fmtMin(selected.plannedMinutes)} · ${selected.total} séance${selected.total > 1 ? "s" : ""}`
              : [
                  `${fmtN(selected.load)} UA${selected.plannedLoad ? ` sur ${fmtN(selected.plannedLoad)} prévues` : ""}`,
                  fmtMin(selected.minutes),
                  selected.total ? `séances ${selected.done}/${selected.total}` : null,
                  selected.forme !== null ? `forme ${String(selected.forme).replace(".", ",")}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>
        <div className="flex flex-col gap-4 border-line lg:border-l lg:pl-6">
          <p className="text-[13px] text-slate">4 dernières semaines</p>
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-[13px] text-ink-soft">{s.label}</p>
              <p className="text-[22px] font-bold leading-tight tracking-tight text-ink">{s.value}</p>
              <p className="text-xs text-slate">{s.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function OverviewTab({
  firstName,
  title,
  subtitle,
  attention,
  weeks,
  stats,
  journal,
  tests,
}: {
  firstName: string;
  title: string;
  subtitle: string;
  attention: AttentionItem[];
  weeks: LoadWeek[];
  stats: OverviewStat[];
  journal: { id: string; date: string; content: string }[];
  tests: { date: string | null; items: { label: string; value: string }[] };
}) {
  const [allJournal, setAllJournal] = useState(false);
  const entries = allJournal ? journal : journal.slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <TabHeader title={title} subtitle={subtitle} />
      <Attention items={attention} />
      <LoadChart weeks={weeks} stats={stats} />
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Panel>
          <PanelTitle
            title={`Journal de ${firstName}`}
            right={
              journal.length > 3 && (
                <button type="button" className={linkBtn} onClick={() => setAllJournal((v) => !v)}>
                  {allJournal ? "Réduire" : "Tout voir"}
                </button>
              )
            }
          />
          {journal.length === 0 ? (
            <p className="text-sm text-slate">{firstName} n&apos;a encore rien écrit.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {entries.map((j) => (
                <li key={j.id} className="grid grid-cols-[72px_1fr] gap-3 text-sm">
                  <span className="text-slate">{j.date}</span>
                  <span className="whitespace-pre-line text-ink">{j.content}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <PanelTitle
            title="Derniers tests"
            right={
              <Link href="?tab=mesures" scroll={false} className="text-[13px] text-slate hover:text-ink">
                {tests.date ?? "Mesures"}
              </Link>
            }
          />
          {tests.items.length === 0 ? (
            <p className="text-sm text-slate">Aucun test renseigné.</p>
          ) : (
            <dl className="flex flex-col">
              {tests.items.map((t) => (
                <div key={t.label} className="flex items-baseline justify-between py-1.5 text-sm">
                  <dt className="text-ink-soft">{t.label}</dt>
                  <dd className="font-semibold text-ink">{t.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>
      </div>
    </div>
  );
}
