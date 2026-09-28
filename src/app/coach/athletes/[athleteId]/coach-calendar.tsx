"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addWorkoutCommentAction,
  coachAddActivityAction,
  coachAddAvailabilityBlockAction,
  coachDeleteEntryAction,
  copyWeekAction,
  duplicateWorkoutAction,
  markWorkoutDoneAsPlannedAction,
  moveWorkoutAction,
} from "@/lib/actions";
import type { CoachCalendarData, CalDay, CalEntry, CalWeek, EntryStatus } from "@/lib/coach-calendar-types";
import { CYCLE_DAY_STYLE } from "@/lib/cycle-types";

// Calendrier coach : semaine (défilement horizontal) ou mois, et un panneau de
// détail qui s'ouvre en douceur sous le calendrier (jour, séance, ajout, copie).

const BAR: Record<EntryStatus, string> = {
  done: "3px solid #1b4b4f",
  part: "3px solid #e8896a",
  miss: "3px solid #9aa39c",
  postponed: "3px solid #9aa39c",
  todo: "3px dashed #1b4b4f",
  hors: "3px solid #b9a18f",
};
const STATUS_LABEL: Record<EntryStatus, string> = {
  done: "Faite",
  part: "Partielle",
  miss: "Non faite",
  postponed: "Reportée",
  todo: "À faire",
  hors: "Hors programme",
};
const STATUS_COLOR: Record<EntryStatus, string> = {
  done: "#0f3336",
  part: "#8a3a1f",
  miss: "#5b6660",
  postponed: "#5b6660",
  todo: "#1b4b4f",
  hors: "#5e4331",
};
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DOW_LONG = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SPORTS = [
  { value: "cycling", label: "Vélo" },
  { value: "running", label: "Course à pied" },
  { value: "swimming", label: "Natation" },
  { value: "hiking", label: "Randonnée" },
  { value: "climbing", label: "Escalade" },
  { value: "strength", label: "Musculation" },
  { value: "other", label: "Divers" },
];

type Panel =
  | { type: "day"; date: string }
  | { type: "entry"; id: string }
  | { type: "add"; date: string; mode: "done" | "todo" | "unavailable" }
  | { type: "copy" }
  | null;

function fmt(m: number | null | undefined): string {
  if (m == null) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h} h ${String(r).padStart(2, "0")}`;
}
function nb(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function longDate(dateISO: string): string {
  const d = parse(dateISO);
  const dow = (d.getDay() + 6) % 7;
  return `${DOW_LONG[dow]} ${d.getDate() === 1 ? "1er" : d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function entrySub(e: CalEntry): string {
  if (e.isGoal) return `Objectif · ${e.sportLabel}`;
  if (e.status === "todo") return [e.sportLabel, e.plannedMin ? fmt(e.plannedMin) : null, e.plannedRpe ? `RPE ${e.plannedRpe} visé` : null].filter(Boolean).join(" · ");
  if (e.status === "miss" || e.status === "postponed") return `${e.sportLabel} · ${STATUS_LABEL[e.status].toLowerCase()}`;
  return [e.sportLabel, fmt(e.realMin ?? e.plannedMin), e.rpe ? `RPE ${e.rpe}` : null].filter(Boolean).join(" · ");
}

export function CoachCalendar({ data }: { data: CoachCalendarData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<Panel>(null);
  const [picker, setPicker] = useState<{ mode: "move" | "dup"; id: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [hoverForme, setHoverForme] = useState<string | null>(null);
  const [popWeek, setPopWeek] = useState<string | null>(null);
  const base = `/coach/athletes/${data.athleteId}`;

  // Animation de glissement entre deux semaines / deux mois.
  const dirRef = useRef(0);
  const [slide, setSlide] = useState<{ x: number; anim: boolean }>({ x: 0, anim: false });
  const key = data.view === "week" ? data.weeks[0]?.weekStart : data.month;
  useEffect(() => {
    if (!dirRef.current) return;
    setSlide({ x: dirRef.current * 60, anim: false });
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setSlide({ x: 0, anim: true })));
    dirRef.current = 0;
    return () => cancelAnimationFrame(r);
  }, [key]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const allDays = useMemo(() => data.weeks.flatMap((w) => w.days), [data.weeks]);
  const findEntry = (id: string) => {
    for (const d of allDays) {
      const e = d.entries.find((x) => x.id === id);
      if (e) return { entry: e, day: d };
    }
    return null;
  };

  function go(href: string, dir: number) {
    dirRef.current = dir;
    setPanel(null);
    setPicker(null);
    setPopWeek(null);
    startTransition(() => router.push(href, { scroll: false }));
  }
  const goWeek = (offset: number) => go(`${base}?view=week&week=${offset}`, offset > data.offset ? 1 : -1);
  const goMonth = (m: string) => go(`${base}?view=month&month=${m}`, m > data.month ? 1 : -1);
  const prev = () => (data.view === "week" ? goWeek(data.offset - 1) : goMonth(data.prevMonth));
  const next = () => (data.view === "week" ? goWeek(data.offset + 1) : goMonth(data.nextMonth));

  function run(fn: () => Promise<unknown>, message: string, after?: () => void) {
    startTransition(async () => {
      try {
        await fn();
        setToast(message);
        after?.();
        router.refresh();
      } catch (e) {
        setToast(e instanceof Error ? e.message : "Une erreur est survenue.");
      }
    });
  }

  function open(p: Panel) {
    setPicker(null);
    setMenu(false);
    setPanel((cur) => (cur && p && JSON.stringify(cur) === JSON.stringify(p) ? null : p));
  }

  // Défilement au trackpad / balayage tactile.
  const wheelLock = useRef(false);
  const touchX = useRef(0);
  function onWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 25 || wheelLock.current) return;
    wheelLock.current = true;
    setTimeout(() => (wheelLock.current = false), 700);
    if (e.deltaX > 0) next();
    else prev();
  }

  const s = data.stats;
  const bar = (v: number, of: number) => `${of ? Math.min(100, Math.round((v / of) * 100)) : 0}%`;

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[28px] font-bold leading-tight tracking-tight text-ink">{data.title}</h2>
          <p className="text-sm text-slate">{data.subtitle}</p>
        </div>
        <span className="flex-1" />
        {data.goal && data.goal.days >= 0 && (
          <div className="flex flex-col items-end gap-1 border-r border-line pr-6">
            <span className="text-[28px] font-bold leading-tight tracking-tight text-[#a4492a]">J-{data.goal.days}</span>
            <span className="text-sm text-slate">
              {data.goal.title} · {data.goal.dateLabel}
            </span>
          </div>
        )}
        <div className="flex rounded-full bg-paper-dim p-[3px]">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => v !== data.view && go(`${base}?view=${v}`, 0)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${data.view === v ? "bg-white text-ink shadow-sm" : "text-slate"}`}
            >
              {v === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-haspopup="menu"
            aria-label="Plus d'actions"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-line bg-white text-ink-soft"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><circle cx="4.5" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="15.5" cy="10" r="1.5" /></svg>
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-11 z-30 flex w-56 flex-col rounded-xl bg-white p-1.5 shadow-[0_10px_28px_rgba(24,34,32,0.18)]">
              {data.view === "week" && (
                <button type="button" role="menuitem" onClick={() => open({ type: "copy" })} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-paper">
                  Copier cette semaine…
                </button>
              )}
              <button type="button" role="menuitem" onClick={() => { setMenu(false); go(`${base}?view=${data.view}`, 0); }} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-paper">
                Revenir à aujourd&apos;hui
              </button>
              <Link role="menuitem" href={`${base}/new-workout`} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-paper">
                Nouvelle séance (éditeur complet)
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Bilan */}
      <div className="flex flex-wrap gap-x-16 gap-y-4">
        {[
          { l: "Charge", v: nb(s.load), of: s.plannedLoad ? `${nb(s.plannedLoad)} UA` : "UA", p: bar(s.load, s.plannedLoad) },
          { l: "Temps", v: fmt(s.minutes), of: s.plannedMinutes ? fmt(s.plannedMinutes) : "", p: bar(s.minutes, s.plannedMinutes) },
          { l: "Séances", v: String(s.done), of: `${s.total} faites`, p: bar(s.done, s.total) },
        ].map((x) => (
          <div key={x.l} className="flex w-[200px] flex-col gap-2">
            <div className="flex items-baseline gap-2 text-sm text-slate">
              <span>{x.l}</span>
              <span className="flex-1" />
              <b className="text-[15px] font-bold text-ink">{x.v}</b>
              {x.of && <span className="text-[13px]">/ {x.of}</span>}
            </div>
            <div className="h-[5px] overflow-hidden rounded-full bg-paper-dim">
              <div className="h-full rounded-full bg-moss transition-[width] duration-500" style={{ width: x.p }} />
            </div>
          </div>
        ))}
      </div>

      {/* Calendrier */}
      <div className="relative -mx-2 overflow-x-auto px-2 pb-1" onWheel={onWheel}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 60) (dx < 0 ? next : prev)(); }}>
        <div
          className="min-w-[860px]"
          style={{
            transform: `translateX(${slide.x}px)`,
            opacity: slide.x ? 0.3 : pending ? 0.7 : 1,
            transition: slide.anim ? "transform 320ms cubic-bezier(.2,.8,.2,1), opacity 320ms ease" : "none",
          }}
        >
          {data.view === "week" ? (
            <div className="flex items-stretch gap-2">
              <button type="button" onClick={prev} aria-label="Semaine précédente" className="w-8 shrink-0 rounded-r-2xl bg-white/60 transition-colors hover:bg-white" />
              <div className="grid flex-1 grid-cols-7 gap-2">
                {data.weeks[0].days.map((d) => (
                  <DayCard
                    key={d.date}
                    day={d}
                    selected={panel}
                    hoverForme={hoverForme}
                    setHoverForme={setHoverForme}
                    onOpenDay={() => open({ type: "day", date: d.date })}
                    onOpenEntry={(id) => open({ type: "entry", id })}
                    onAdd={() => open({ type: "add", date: d.date, mode: d.date <= data.today ? "done" : "todo" })}
                  />
                ))}
              </div>
              <button type="button" onClick={next} aria-label="Semaine suivante" className="w-8 shrink-0 rounded-l-2xl bg-white/60 transition-colors hover:bg-white" />
            </div>
          ) : (
            <MonthGrid data={data} panel={panel} popWeek={popWeek} setPopWeek={setPopWeek} onPrev={prev} onNext={next}
              onOpenDay={(date) => open({ type: "day", date })} onOpenEntry={(id) => open({ type: "entry", id })} />
          )}
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate">
        {(["done", "part", "miss", "todo", "hors"] as EntryStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-3" style={{ borderLeft: BAR[k] }} />
            {STATUS_LABEL[k]}
          </span>
        ))}
        {data.cycleShared && (
          <>
            <span className="mx-1 h-3.5 w-px bg-line" />
            <span>Cycle de {data.athleteName}</span>
            {(["regles", "foll", "ovu", "lut"] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: CYCLE_DAY_STYLE[k].dot }} />
                {{ regles: "Règles", foll: "Folliculaire", ovu: "Ovulation", lut: "Lutéale" }[k]}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Panneau de détail */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{ gridTemplateRows: panel ? "1fr" : "0fr", opacity: panel ? 1 : 0 }}
      >
        <div className={panel ? "overflow-visible" : "overflow-hidden"}>
          {panel && (
            <section className="relative rounded-[20px] border-2 border-ink bg-white p-6">
              <button type="button" onClick={() => setPanel(null)} aria-label="Fermer" className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-paper text-ink-soft">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
              </button>
              {panel.type === "day" && <DayPanel day={allDays.find((d) => d.date === panel.date)} data={data} onOpenEntry={(id) => open({ type: "entry", id })} onDelete={(kind, id) => run(() => coachDeleteEntryAction(kind, id), "Supprimé")} />}
              {panel.type === "entry" && (() => {
                const f = findEntry(panel.id);
                if (!f) return <p className="text-sm text-slate">Cette entrée n&apos;est plus dans la période affichée.</p>;
                return (
                  <EntryPanel
                    entry={f.entry}
                    data={data}
                    picker={picker}
                    setPicker={setPicker}
                    pending={pending}
                    onDone={() => run(() => markWorkoutDoneAsPlannedAction(f.entry.id), "Séance marquée faite")}
                    onPick={(mode, date) =>
                      run(
                        () => (mode === "move" ? moveWorkoutAction({ workoutId: f.entry.id, date }) : duplicateWorkoutAction({ workoutId: f.entry.id, targetDate: date })),
                        mode === "move" ? `Séance déplacée au ${longDate(date).toLowerCase()}` : `Séance dupliquée au ${longDate(date).toLowerCase()}`,
                        () => setPicker(null)
                      )
                    }
                    onDeleteImport={() => run(() => coachDeleteEntryAction("activity", f.entry.id), "Activité supprimée", () => setPanel(null))}
                    onComment={(body) => {
                      const fd = new FormData();
                      fd.set("body", body);
                      run(() => addWorkoutCommentAction(f.entry.id, fd), "Commentaire envoyé");
                    }}
                  />
                );
              })()}
              {panel.type === "add" && (
                <AddPanel
                  key={panel.date}
                  data={data}
                  date={panel.date}
                  mode={panel.mode}
                  setMode={(mode) => setPanel({ ...panel, mode })}
                  pending={pending}
                  onActivity={(fd) => run(() => coachAddActivityAction(data.athleteId, fd), "Séance faite ajoutée", () => setPanel({ type: "day", date: panel.date }))}
                  onUnavailable={(timeOfDay, reason) =>
                    run(() => coachAddAvailabilityBlockAction({ athleteId: data.athleteId, dates: [panel.date], timeOfDay, reason }), "Indisponibilité ajoutée", () => setPanel({ type: "day", date: panel.date }))
                  }
                />
              )}
              {panel.type === "copy" && (
                <CopyPanel
                  data={data}
                  onCopy={(target) =>
                    run(() => copyWeekAction({ athleteId: data.athleteId, sourceWeekStart: data.weeks[0].weekStart, targetWeekStart: target }), "Semaine copiée", () => setPanel(null))
                  }
                />
              )}
            </section>
          )}
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(24,34,32,0.28)]">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FormeLine({ day, hoverForme, setHoverForme, compact }: { day: CalDay; hoverForme: string | null; setHoverForme: (d: string | null) => void; compact?: boolean }) {
  const f = day.forme;
  const low = !!f && f.score < 6;
  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => f && setHoverForme(day.date)}
        onMouseLeave={() => setHoverForme(null)}
        onClick={(e) => { e.stopPropagation(); if (f) setHoverForme(hoverForme === day.date ? null : day.date); }}
        aria-label="Forme du jour"
        className={`inline-flex items-center gap-1.5 ${compact ? "text-[11.5px]" : "text-xs"} font-semibold`}
        style={{ color: f ? (low ? "#8a3a1f" : "#37413f") : "#9aa39c" }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: f ? (low ? "#d9822b" : "#1b4b4f") : "#d5dbda" }} />
        {f ? `Forme ${String(f.score).replace(".", ",")}` : "Forme —"}
      </button>
      {f && hoverForme === day.date && (
        <div role="tooltip" className="absolute left-0 top-6 z-20 flex w-56 flex-col gap-1.5 rounded-xl bg-ink px-3.5 py-3 text-white shadow-[0_10px_28px_rgba(24,34,32,0.28)]">
          <b className="text-[15px]">{String(f.score).replace(".", ",")} / 10 · {f.label.toLowerCase()}</b>
          <span className="text-[12.5px] leading-relaxed text-[#e6eae9]">
            Physique {f.physical}/10 · Mental {f.mental}/10
            <br />
            Sommeil {f.sleep}/10 · Courbatures {f.soreness}/10
            <br />
            Stress {f.stress}/10
          </span>
          {f.notes && <span className="text-xs text-[#c4cbc9]">« {f.notes} »</span>}
        </div>
      )}
    </div>
  );
}

function CycleLine({ day, compact }: { day: CalDay; compact?: boolean }) {
  const c = day.cycle;
  if (!c) return null;
  const st = CYCLE_DAY_STYLE[c.key];
  return (
    <span title={c.text} className={`inline-flex items-center gap-1.5 font-semibold ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: st.text }}>
      <span className="h-2 w-2 rounded-full" style={{ background: st.dot }} />
      {compact ? (c.first ? c.short : "") : `${c.short} · J${c.day}`}
    </span>
  );
}

function DayCard({
  day,
  selected,
  hoverForme,
  setHoverForme,
  onOpenDay,
  onOpenEntry,
  onAdd,
}: {
  day: CalDay;
  selected: Panel;
  hoverForme: string | null;
  setHoverForme: (d: string | null) => void;
  onOpenDay: () => void;
  onOpenEntry: (id: string) => void;
  onAdd: () => void;
}) {
  const isSel = (selected?.type === "day" && selected.date === day.date) || (selected?.type === "add" && selected.date === day.date);
  const empty = day.entries.length + day.blocks.length === 0;
  return (
    <div
      onClick={(e) => { if ((e.target as HTMLElement).closest("button")) return; onOpenDay(); }}
      className="relative flex min-h-[230px] cursor-pointer flex-col gap-3 rounded-2xl px-2.5 pb-2.5 pt-3 transition-colors"
      style={{ background: day.isToday ? "#fffaf7" : "#ffffff", border: `2px solid ${isSel ? "#1b4b4f" : day.isToday ? "#e8896a" : "transparent"}` }}
    >
      {day.isToday && <div className="-mx-2.5 -mt-3 rounded-t-[13px] bg-gold-light py-1 text-center text-[11px] font-bold text-[#3b1f0c]">Aujourd&apos;hui</div>}
      <button type="button" onClick={onOpenDay} className="flex items-baseline gap-1.5 self-start">
        <span className="text-xs font-semibold" style={{ color: day.isToday ? "#a4492a" : "#5b6660" }}>{day.dow}</span>
        <span className="text-[19px] font-bold" style={{ color: day.isToday ? "#a4492a" : "#182220" }}>{day.num}</span>
      </button>
      <div className="flex flex-col gap-1.5">
        <FormeLine day={day} hoverForme={hoverForme} setHoverForme={setHoverForme} />
        <CycleLine day={day} />
      </div>
      {day.entries.map((e) => {
        const on = selected?.type === "entry" && selected.id === e.id;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onOpenEntry(e.id)}
            className="rounded-r-lg py-1 pl-2.5 pr-1.5 text-left transition-colors"
            style={{ borderLeft: e.isGoal ? "3px solid #a4492a" : BAR[e.status], background: on ? "#eef1f0" : "transparent", opacity: e.isDraft ? 0.6 : 1 }}
          >
            <span className="block text-[13px] font-bold leading-snug text-ink">{e.title}{e.isDraft ? " · brouillon" : ""}</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-soft">{entrySub(e)}</span>
          </button>
        );
      })}
      {day.blocks.map((b) => (
        <span key={b.id} className="px-1.5 text-xs text-ink-soft">{b.label}{b.reason ? ` · ${b.reason}` : ""}</span>
      ))}
      <span className="flex-1" />
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Ajouter le ${day.num}`}
        className="rounded-lg border border-dashed border-line py-1.5 text-sm text-moss transition-opacity hover:opacity-100"
        style={{ opacity: empty ? 1 : 0.55 }}
      >
        +
      </button>
    </div>
  );
}

function MonthGrid({
  data,
  panel,
  popWeek,
  setPopWeek,
  onPrev,
  onNext,
  onOpenDay,
  onOpenEntry,
}: {
  data: CoachCalendarData;
  panel: Panel;
  popWeek: string | null;
  setPopWeek: (w: string | null) => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenDay: (date: string) => void;
  onOpenEntry: (id: string) => void;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <button type="button" onClick={onPrev} aria-label="Mois précédent" className="w-8 shrink-0 rounded-r-2xl bg-white/60 hover:bg-white" />
      <div className="flex-1">
        <div className="mb-1.5 grid grid-cols-[repeat(7,minmax(0,1fr))_180px] gap-1.5 px-1 text-xs font-semibold text-slate">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim", "Semaine"].map((l) => <span key={l}>{l}</span>)}
        </div>
        <div className="flex flex-col gap-1.5">
          {data.weeks.map((w) => (
            <div key={w.weekStart} className="grid grid-cols-[repeat(7,minmax(0,1fr))_180px] gap-1.5">
              {w.days.map((d) => {
                const sel = panel?.type === "day" && panel.date === d.date;
                return (
                  <div
                    key={d.date}
                    onClick={(e) => { if ((e.target as HTMLElement).closest("button")) return; onOpenDay(d.date); }}
                    className="flex min-h-[104px] cursor-pointer flex-col gap-1.5 overflow-hidden rounded-xl px-2 py-2"
                    style={{ background: d.isToday ? "#fffaf7" : d.inMonth ? "#ffffff" : "#f7f8f8", border: `2px solid ${sel ? "#1b4b4f" : d.isToday ? "#e8896a" : "transparent"}` }}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[15px] font-bold" style={{ color: d.isToday ? "#a4492a" : d.inMonth ? "#182220" : "#9aa39c" }}>{d.num}</span>
                      <span className="flex-1" />
                      {d.forme && (
                        <span className="text-[11.5px] font-semibold" style={{ color: d.forme.score < 6 ? "#8a3a1f" : "#5b6660" }}>● {String(d.forme.score).replace(".", ",")}</span>
                      )}
                    </div>
                    <CycleLine day={d} compact />
                    {d.entries.map((e) => (
                      <button key={e.id} type="button" onClick={() => onOpenEntry(e.id)} className="truncate py-px pl-1.5 text-left text-[12.5px] font-semibold text-ink" style={{ borderLeft: e.isGoal ? "3px solid #a4492a" : BAR[e.status], opacity: e.isDraft ? 0.6 : 1 }}>
                        {e.title}
                      </button>
                    ))}
                    {d.blocks.map((b) => (
                      <span key={b.id} className="text-[11.5px] text-slate">{b.label}</span>
                    ))}
                  </div>
                );
              })}
              <WeekSummary w={w} open={popWeek === w.weekStart} toggle={() => setPopWeek(popWeek === w.weekStart ? null : w.weekStart)} onOpenEntry={onOpenEntry} />
            </div>
          ))}
        </div>
      </div>
      <button type="button" onClick={onNext} aria-label="Mois suivant" className="w-8 shrink-0 rounded-l-2xl bg-white/60 hover:bg-white" />
    </div>
  );
}

function WeekSummary({ w, open, toggle, onOpenEntry }: { w: CalWeek; open: boolean; toggle: () => void; onOpenEntry: (id: string) => void }) {
  const total = w.disciplines.reduce((a, d) => a + d.minutes, 0);
  let acc = 0;
  const pie = total
    ? `conic-gradient(${w.disciplines.map((d) => { const p = (d.minutes / total) * 100; const s = `${d.color} ${acc.toFixed(1)}% ${(acc + p).toFixed(1)}%`; acc += p; return s; }).join(", ")})`
    : "#e6eae9";
  const acts = w.days.flatMap((d) => d.entries.filter((e) => e.status === "done" || e.status === "part" || e.status === "hors"));
  return (
    <div className="relative">
      <button type="button" onClick={toggle} className="flex h-full w-full flex-col gap-0.5 rounded-xl border-l-2 border-line py-1.5 pl-3 text-left text-xs text-slate hover:bg-white/70">
        <b className="text-[13px] text-ink">S{w.number}{w.period ? ` · ${w.period}` : ""}</b>
        <span>Charge <b className="text-ink">{nb(w.load)}</b></span>
        <span>Volume <b className="text-ink">{w.km ? `${String(w.km).replace(".", ",")} km` : "—"}</b></span>
        <span>Temps <b className="text-ink">{fmt(w.minutes)}</b></span>
        <span>{w.done}/{w.total} séances</span>
      </button>
      {open && (
        <div className="absolute right-0 top-2 z-30 flex w-[320px] flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_14px_36px_rgba(24,34,32,0.2)]">
          <div className="flex items-center">
            <b className="text-sm text-ink">Par discipline</b>
            <span className="flex-1" />
            <button type="button" onClick={toggle} aria-label="Fermer" className="text-lg text-slate">×</button>
          </div>
          {total ? (
            <div className="flex items-center gap-4">
              <div role="img" aria-label="Répartition par discipline" className="flex h-[96px] w-[96px] shrink-0 items-center justify-center rounded-full" style={{ background: pie }}>
                <div className="flex h-[54px] w-[54px] flex-col items-center justify-center rounded-full bg-white">
                  <b className="text-[13px] text-ink">{fmt(w.minutes)}</b>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
                {w.disciplines.map((d) => (
                  <span key={d.label} className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                    {d.label} · {fmt(d.minutes)} · {Math.round((d.minutes / total) * 100)} %
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-slate">Rien de réalisé cette semaine.</p>
          )}
          {acts.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-paper-dim pt-2">
              {acts.map((e) => (
                <button key={e.id} type="button" onClick={() => onOpenEntry(e.id)} className="flex items-baseline gap-2 text-left text-[13px]">
                  <span className="font-semibold text-ink">{e.title}</span>
                  <span className="text-slate">{e.sportLabel} · {fmt(e.realMin ?? e.plannedMin)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PanelHead({ date, title, children }: { date: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start gap-3 pr-14">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold text-slate">{date}</span>
        <h3 className="text-2xl font-bold tracking-tight text-ink">{title}</h3>
      </div>
      <span className="flex-1" />
      {children}
    </div>
  );
}

const pill = "rounded-full border border-line bg-white px-4 py-2 text-[13.5px] font-semibold text-moss transition-colors hover:bg-paper disabled:opacity-50";
const pillMain = "rounded-full bg-moss px-4 py-2 text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-50";

function DayPanel({ day, data, onOpenEntry, onDelete }: { day?: CalDay; data: CoachCalendarData; onOpenEntry: (id: string) => void; onDelete: (kind: "activity" | "availability", id: string) => void }) {
  if (!day) return null;
  const f = day.forme;
  return (
    <div>
      <PanelHead date={`Semaine ${data.weeks.find((w) => w.days.includes(day))?.number ?? ""}`} title={longDate(day.date)} />
      <div className="grid gap-7 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <b className="text-sm text-ink">Séances et activités</b>
          {day.entries.length === 0 && day.blocks.length === 0 && <p className="text-[13.5px] text-slate">Rien de prévu ce jour-là.</p>}
          {day.entries.map((e) => (
            <button key={e.id} type="button" onClick={() => onOpenEntry(e.id)} className="py-1 pl-3 text-left" style={{ borderLeft: e.isGoal ? "3px solid #a4492a" : BAR[e.status] }}>
              <span className="block text-sm font-semibold text-ink">{e.title}</span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">{entrySub(e)}{e.reportedByCoach ? " · renseignée par vous" : ""}</span>
            </button>
          ))}
          {day.blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-3 border-l-[3px] border-line py-1 pl-3">
              <div className="flex-1">
                <span className="block text-sm font-semibold text-ink">{b.label}</span>
                {b.reason && <span className="block text-[13px] text-ink-soft">{b.reason}</span>}
              </div>
              {b.createdByMe && (
                <button type="button" onClick={() => onDelete("availability", b.id)} aria-label="Supprimer l'indisponibilité" className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-slate">×</button>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <b className="text-sm text-ink">Forme du jour</b>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            {f ? `${String(f.score).replace(".", ",")} / 10 — physique ${f.physical}/10, mental ${f.mental}/10, sommeil ${f.sleep}/10, courbatures ${f.soreness}/10, stress ${f.stress}/10` : "Pas de check-in ce jour-là."}
          </p>
          {f?.notes && <p className="text-[13px] text-slate">« {f.notes} »</p>}
          {day.cycle && (
            <>
              <b className="mt-2.5 text-sm text-ink">Cycle</b>
              <p className="text-[13.5px] leading-relaxed text-ink-soft">
                <b className="font-semibold" style={{ color: CYCLE_DAY_STYLE[day.cycle.key].text }}>{day.cycle.text}</b>
                <br />
                {CYCLE_DAY_STYLE[day.cycle.key].note}
                <br />
                <span className="text-[12.5px] text-[#7a8480]">Partagé par {data.athleteName} · repère général, à confirmer avec son ressenti</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EntryPanel({
  entry: e,
  data,
  picker,
  setPicker,
  pending,
  onDone,
  onPick,
  onDeleteImport,
  onComment,
}: {
  entry: CalEntry;
  data: CoachCalendarData;
  picker: { mode: "move" | "dup"; id: string } | null;
  setPicker: (p: { mode: "move" | "dup"; id: string } | null) => void;
  pending: boolean;
  onDone: () => void;
  onPick: (mode: "move" | "dup", date: string) => void;
  onDeleteImport: () => void;
  onComment: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const realised = e.status === "done" || e.status === "part" || e.status === "hors";
  const warnDur = !!e.plannedMin && !!e.realMin && e.realMin < e.plannedMin * 0.9;
  const warnRpe = !!e.plannedRpe && !!e.rpe && e.rpe > e.plannedRpe;
  const isWorkout = e.kind === "workout";
  const togglePicker = (mode: "move" | "dup") => setPicker(picker?.mode === mode ? null : { mode, id: e.id });
  const send = () => {
    if (!draft.trim()) return;
    onComment(draft.trim());
    setDraft("");
  };

  return (
    <div>
      <PanelHead date={longDate(e.date)} title={e.title}>
        <div className="flex flex-wrap gap-2">
          {isWorkout && e.status === "todo" && <button type="button" disabled={pending} onClick={onDone} className={pillMain}>Marquer faite</button>}
          {isWorkout && <Link href={`/workouts/${e.id}/edit`} className={pill}>Modifier</Link>}
          {isWorkout && <button type="button" disabled={pending} onClick={() => togglePicker("dup")} className={pill} style={picker?.mode === "dup" ? { background: "#e3eeed" } : undefined}>{e.status === "miss" ? "Reprogrammer" : "Dupliquer"}</button>}
          {isWorkout && e.status === "todo" && <button type="button" disabled={pending} onClick={() => togglePicker("move")} className={pill} style={picker?.mode === "move" ? { background: "#e3eeed" } : undefined}>Déplacer</button>}
          {!isWorkout && e.createdByMe && <button type="button" disabled={pending} onClick={onDeleteImport} className={pill}>Supprimer</button>}
        </div>
      </PanelHead>
      <div className="-mt-3 mb-5 flex items-center gap-2.5 text-sm text-ink-soft">
        <span className="h-4" style={{ borderLeft: e.isGoal ? "3px solid #a4492a" : BAR[e.status] }} />
        <b style={{ color: STATUS_COLOR[e.status] }}>{e.isGoal ? "Objectif" : STATUS_LABEL[e.status]}</b>
        <span className="text-[#aab4b1]">·</span>
        {e.sportLabel}
        {e.timeLabel && <><span className="text-[#aab4b1]">·</span>{e.timeLabel}</>}
        {e.isDraft && <><span className="text-[#aab4b1]">·</span>brouillon, pas encore visible par l&apos;athlète</>}
      </div>

      {picker && picker.id === e.id && (
        <DatePicker data={data} mode={picker.mode} currentDate={e.date} onPick={(d) => onPick(picker.mode, d)} onCancel={() => setPicker(null)} />
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          {realised ? (
            <div className="grid grid-cols-2 border-y border-paper-dim sm:grid-cols-5">
              {[
                { l: "Durée", v: fmt(e.realMin), sub: e.plannedMin ? `prévu ${fmt(e.plannedMin)}` : e.kind === "import" ? "hors programme" : "", warn: warnDur },
                { l: "RPE", v: e.rpe ? String(e.rpe) : "—", sub: e.plannedRpe ? `visé ${e.plannedRpe}` : "", warn: warnRpe },
                { l: "Charge", v: e.realMin && e.rpe ? `${nb(e.realMin * e.rpe)} UA` : "—", sub: e.plannedMin && e.plannedRpe ? `prévu ${nb(e.plannedMin * e.plannedRpe)}` : "", warn: false },
                { l: "Distance", v: e.distanceKm ? `${String(e.distanceKm).replace(".", ",")} km` : "—", sub: e.elevation ? `D+ ${nb(e.elevation)} m` : "", warn: false },
                { l: e.power ? "Puissance" : "FC moyenne", v: e.power ? `${e.power} W` : e.avgHr ? `${e.avgHr} bpm` : "—", sub: e.power && e.avgHr ? `FC ${e.avgHr} bpm` : "", warn: false },
              ].map((x, i) => (
                <div key={x.l} className={`flex flex-col gap-1 py-4 ${i ? "sm:border-l sm:border-paper-dim sm:pl-5" : ""}`}>
                  <span className="text-[13px] text-slate">{x.l}</span>
                  <b className="text-[22px] font-bold leading-tight tracking-tight whitespace-nowrap" style={{ color: x.warn ? "#8a3a1f" : "#182220" }}>{x.v}</b>
                  {x.sub && <span className="text-xs text-slate">{x.sub}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-10 border-y border-paper-dim py-4 text-sm text-slate">
              <span>Durée prévue <b className="mt-1 block text-[22px] text-ink">{fmt(e.plannedMin)}</b></span>
              {e.plannedRpe && <span>RPE visé <b className="mt-1 block text-[22px] text-ink">{e.plannedRpe}</b></span>}
              {e.plan.map((p) => <span key={p.label}>{p.label} <b className="mt-1 block text-[22px] text-ink">{p.value}</b></span>)}
              {e.timeLabel && <span>Moment <b className="mt-1 block text-[22px] text-ink">{e.timeLabel}</b></span>}
            </div>
          )}
          {(e.content.length > 0 || e.description) && (
            <div>
              <h4 className="mb-2.5 text-sm font-bold text-ink">Contenu prévu</h4>
              {e.content.map((l, i) => {
                const indented = /^\s{2,}/.test(l);
                const title = !indented && !/^\d|×|·/.test(l.trim()) && e.content[i + 1] && /^\s{2,}/.test(e.content[i + 1]);
                return (
                  <div key={i} className="text-sm leading-[1.8]" style={{ paddingLeft: indented ? 14 : 0, fontWeight: title ? 700 : 400, color: title ? "#182220" : "#37413f", marginTop: title && i ? 8 : 0 }}>
                    {l.trim()}
                  </div>
                );
              })}
              {e.description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{e.description}</p>}
            </div>
          )}
          {e.feedback && (
            <div>
              <h4 className="mb-1.5 text-sm font-bold text-ink">Retour de {data.athleteName}</h4>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{e.feedback}</p>
            </div>
          )}
        </div>

        {isWorkout && (
          <div className="flex flex-col gap-3 lg:border-l lg:border-paper-dim lg:pl-7">
            <b className="text-sm text-ink">Commentaires <span className="font-normal text-slate">{e.comments.length}</span></b>
            {e.comments.length === 0 && <p className="text-[13px] text-slate">Aucun commentaire pour l&apos;instant.</p>}
            <div className="flex max-h-[320px] flex-col gap-3.5 overflow-y-auto">
              {e.comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: c.mine ? "#e3eeed" : "#fbe6dd", color: c.mine ? "#0f3336" : "#8a3a1f" }}>{c.init}</div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[12.5px]"><b className="text-ink">{c.who}</b> <span className="text-[#7a8480]">· {c.when}</span></span>
                    <span className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{c.body}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === "Enter") send(); }}
                placeholder="Ajouter un commentaire…"
                className="min-w-0 flex-1 rounded-full border border-paper-dim bg-[#f5f7f6] px-4 py-2.5 text-sm text-ink outline-none focus:border-moss"
              />
              <button type="button" onClick={send} disabled={pending || !draft.trim()} aria-label="Envoyer" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-paper-dim bg-[#f5f7f6] text-moss disabled:opacity-50">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l14-6-6 14-2-6z" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DatePicker({ data, mode, currentDate, onPick, onCancel }: { data: CoachCalendarData; mode: "move" | "dup"; currentDate: string; onPick: (d: string) => void; onCancel: () => void }) {
  // Mini calendrier à partir de la semaine en cours : il suffit de choisir la date.
  const t = parse(data.today);
  const monday = new Date(t);
  monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const x = new Date(monday);
      x.setDate(monday.getDate() + w * 7 + d);
      return iso(x);
    })
  );
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-paper p-4 animate-expand-in">
      <div className="flex items-center gap-3">
        <b className="text-sm text-ink">{mode === "move" ? "Déplacer au…" : "Dupliquer le…"}</b>
        <span className="text-[13px] text-slate">Choisissez la date</span>
        <span className="flex-1" />
        <button type="button" onClick={onCancel} className="text-[13px] font-semibold text-slate">Annuler</button>
      </div>
      <div className="grid max-w-[460px] grid-cols-7 gap-1 text-center">
        {["L", "M", "M", "J", "V", "S", "D"].map((l, i) => <span key={i} className="text-xs font-semibold text-slate">{l}</span>)}
        {weeks.flat().map((d) => {
          const past = d < data.today;
          const same = d === currentDate && mode === "move";
          const x = parse(d);
          return (
            <button
              key={d}
              type="button"
              disabled={past || same}
              onClick={() => onPick(d)}
              className="flex flex-col items-center rounded-lg py-1.5 text-[13px] font-semibold transition-colors enabled:hover:bg-[#e3eeed] disabled:opacity-35"
              style={{ background: d === currentDate ? "#e3eeed" : "#ffffff", border: d === data.today ? "1.5px solid #e8896a" : "1.5px solid transparent" }}
            >
              {x.getDate()}
              {x.getDate() === 1 && <span className="text-[10px] font-normal text-slate">{MONTHS[x.getMonth()].slice(0, 4)}.</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddPanel({
  data,
  date,
  mode,
  setMode,
  pending,
  onActivity,
  onUnavailable,
}: {
  data: CoachCalendarData;
  date: string;
  mode: "done" | "todo" | "unavailable";
  setMode: (m: "done" | "todo" | "unavailable") => void;
  pending: boolean;
  onActivity: (fd: FormData) => void;
  onUnavailable: (timeOfDay: string, reason: string) => void;
}) {
  const [slot, setSlot] = useState("full_day");
  const [reason, setReason] = useState("");
  const future = date > data.today;
  const input = "rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm font-normal text-ink";
  return (
    <div>
      <PanelHead date={longDate(date)} title={mode === "unavailable" ? "Nouvelle indisponibilité" : mode === "done" ? "Séance déjà faite" : "Nouvelle séance"} />
      <div className="mb-5 flex self-start">
        <div className="flex rounded-full bg-paper-dim p-[3px]">
          {([
            ["done", "Séance faite"],
            ["todo", "Séance à faire"],
            ["unavailable", "Indisponibilité"],
          ] as const).map(([m, l]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${mode === m ? "bg-white text-ink shadow-sm" : "text-slate"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {mode === "done" && (
        future ? (
          <p className="text-sm text-slate">Une séance déjà faite ne peut pas être dans le futur.</p>
        ) : (
          <form
            action={(fd) => {
              fd.set("activityDate", date);
              onActivity(fd);
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-3 sm:grid-cols-5">
              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">Activité
                <select name="sport" defaultValue="cycling" className={input}>{SPORTS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">Durée (min)<input name="durationMinutes" type="number" min={1} required className={input} /></label>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">RPE<input name="rpe" type="number" min={1} max={10} className={input} /></label>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">Distance (km)<input name="distanceKm" type="number" step="0.1" min={0} className={input} /></label>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">FC moyenne<input name="avgHr" type="number" min={30} max={230} className={input} /></label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">Notes<textarea name="notes" rows={2} placeholder="Ce que l'athlète vous a dit de la séance…" className={`${input} resize-y`} /></label>
            <div><button type="submit" disabled={pending} className={pillMain}>Enregistrer</button></div>
          </form>
        )
      )}

      {mode === "todo" && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-ink-soft">La séance se construit dans l&apos;éditeur, avec la date déjà renseignée.</p>
          <Link href={`/coach/athletes/${data.athleteId}/new-workout?date=${date}`} className={pillMain}>Construire la séance</Link>
        </div>
      )}

      {mode === "unavailable" && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">Moment
              <select value={slot} onChange={(ev) => setSlot(ev.target.value)} className={input}>
                <option value="full_day">Journée entière</option>
                <option value="morning">Matin</option>
                <option value="midday">Midi</option>
                <option value="afternoon">Après-midi</option>
                <option value="evening">Soir</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">Motif
              <input value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Déplacement, examens…" className={input} />
            </label>
          </div>
          <div><button type="button" disabled={pending} onClick={() => onUnavailable(slot, reason)} className={pillMain}>Enregistrer</button></div>
        </div>
      )}
    </div>
  );
}

function CopyPanel({ data, onCopy }: { data: CoachCalendarData; onCopy: (target: string) => void }) {
  const start = parse(data.weeks[0].weekStart);
  const targets = [1, 2, 3].map((n) => {
    const d = new Date(start);
    d.setDate(start.getDate() + n * 7);
    const e = new Date(d);
    e.setDate(d.getDate() + 6);
    return { iso: iso(d), label: `${d.getDate()} – ${e.getDate()} ${MONTHS[e.getMonth()]}` };
  });
  return (
    <div>
      <PanelHead date={data.title} title="Copier la semaine" />
      <p className="mb-4 max-w-2xl text-sm text-ink-soft">
        Les séances programmées de cette semaine sont recopiées « à faire », le même jour de la semaine choisie. Les indisponibilités et les activités hors programme ne sont pas copiées.
      </p>
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <button key={t.iso} type="button" onClick={() => onCopy(t.iso)} className={pill}>Vers la semaine du {t.label}</button>
        ))}
      </div>
    </div>
  );
}
