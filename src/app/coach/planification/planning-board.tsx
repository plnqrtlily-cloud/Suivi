"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  copyWeekAction,
  createWorkoutAction,
  duplicateWorkoutAction,
  planningDeleteWorkoutAction,
  planningMoveWorkoutAction,
  planningUpdateWorkoutAction,
  publishWorkoutAction,
  publishWorkoutsAction,
} from "@/lib/actions";
import { Avatar } from "@/components/avatar";

// Planification : tous les athlètes sur une frise horaire. Vue semaine : la
// frise défile jour par jour (7 jours visibles), vue mois : semaine par semaine
// (5 semaines visibles) — même défilement continu que le calendrier de la
// fiche athlète. Séances déplaçables par glisser-déposer (autre jour ou autre
// athlète), création dans une case vide, détail, duplication.

export type PlanStatus = "done" | "part" | "miss" | "todo" | "goal";

export interface PlanAthlete {
  id: string;
  name: string;
  fullName: string;
  avatarPath: string | null;
  sports: string[];
}
export interface PlanItem {
  id: string;
  athleteId: string;
  date: string;
  title: string;
  sport: string;
  sportLabel: string;
  minutes: number;
  doneMinutes: number;
  status: PlanStatus;
  isGoal: boolean;
  isDraft: boolean;
  mine: boolean;
}
export interface PlanBlock {
  id: string;
  athleteId: string;
  date: string;
  label: string;
}

const COLOR: Record<PlanStatus, string> = { done: "#1b4b4f", part: "#e8896a", miss: "#9aa39c", todo: "#1b4b4f", goal: "#a4492a" };
const STATUS_LABEL: Record<PlanStatus, string> = { done: "Réalisée", part: "Partielle", miss: "Non réalisée", todo: "À faire", goal: "Objectif" };
const SPORTS = [
  { value: "cycling", label: "Vélo" },
  { value: "running", label: "Course à pied" },
  { value: "swimming", label: "Natation" },
  { value: "hiking", label: "Randonnée" },
  { value: "climbing", label: "Escalade" },
  { value: "strength", label: "Musculation" },
  { value: "other", label: "Divers" },
];
const SPORT_LABEL: Record<string, string> = Object.fromEntries(SPORTS.map((s) => [s.value, s.label]));
const PRESETS: [string, number][] = [
  ["Endurance", 75],
  ["Sortie longue", 180],
  ["Fractionné", 60],
  ["Seuil 3 × 10 min", 65],
  ["PMA 30-30", 60],
  ["Technique", 50],
  ["Renfo", 45],
  ["Récupération", 45],
];
const DURATIONS = [20, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];
const DN = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const ML = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const ROW_H = 70;
const MROW_H = 76;

function parse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
function dow(s: string): number {
  return (parse(s).getDay() + 6) % 7;
}
function diffDays(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}
function frs(s: string): string {
  const d = parse(s);
  return `${d.getDate()} ${MS[d.getMonth()]}`;
}
function isoWeek(s: string): number {
  const d = parse(s);
  d.setDate(d.getDate() - dow(s) + 3);
  const f = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - f.getTime()) / 86400000 - 3 + ((f.getDay() + 6) % 7)) / 7);
}
function hm(m: number): string {
  m = Math.round(m);
  if (!m) return "0";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} h${r ? ` ${String(r).padStart(2, "0")}` : ""}` : `${r} min`;
}
function dayLong(s: string): string {
  return `${DN[dow(s)].toLowerCase()}. ${frs(s)}`;
}
function guessSport(a: PlanAthlete): string {
  return a.sports.find((s) => s !== "other") || "cycling";
}

type Panel = { type: "item"; id: string } | { type: "new"; athleteId: string; date: string } | null;

export function PlanningBoard({
  athletes,
  items: initialItems,
  blocks,
  start,
  days: nd,
  today,
}: {
  athletes: PlanAthlete[];
  items: PlanItem[];
  blocks: PlanBlock[];
  start: string;
  days: number;
  today: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  // Nouvelles données du serveur (après une action) : on repart d'elles.
  const [seen, setSeen] = useState(initialItems);
  if (seen !== initialItems) {
    setSeen(initialItems);
    setItems(initialItems);
  }

  const nw = nd / 7;
  const todayIdx = diffDays(start, today);
  const todayMon = todayIdx - dow(today);
  const [view, setView] = useState<"week" | "month">("week");
  const [fi, setFi] = useState(Math.max(0, Math.min(nd - 7, todayMon)));
  const [mi, setMi] = useState(Math.max(0, Math.min(nw - 5, todayMon / 7 - 1)));
  const [q, setQ] = useState("");
  const [sport, setSport] = useState("all");
  const [panel, setPanel] = useState<Panel>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ title: "", sport: "cycling", minutes: "60", date: "" });
  const [dup, setDup] = useState<string[]>([]);
  const [err, setErr] = useState("");

  const stripRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const dayAt = (i: number) => addDays(start, i);
  const per = view === "week" ? 7 : 5;
  const count = view === "week" ? nd : nw;

  // Recalage sur la position mémorisée à chaque changement de vue.
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const col = el.scrollWidth / count;
    el.scrollLeft = (view === "week" ? fi : mi) * col;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function onScroll() {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const el = stripRef.current;
      if (!el || !el.clientWidth) return;
      const i = Math.max(0, Math.min(count - per, Math.round(el.scrollLeft / (el.scrollWidth / count))));
      if (view === "week") setFi(i);
      else setMi(i);
    });
  }
  function jump(i: number) {
    const max = count - per;
    i = Math.max(0, Math.min(max, i));
    const el = stripRef.current;
    if (el) el.scrollTo({ left: i * (el.scrollWidth / count), behavior: "smooth" });
    else if (view === "week") setFi(i);
    else setMi(i);
  }
  function switchView(v: "week" | "month") {
    if (v === view) return;
    setPanel(null);
    if (v === "month") setMi(Math.max(0, Math.min(nw - 5, Math.floor((fi + 3) / 7) - 1)));
    else setFi(Math.max(0, Math.min(nd - 7, 7 * (mi + 1))));
    setView(v);
  }

  function run(fn: () => Promise<unknown>, message: string, after?: () => void) {
    startTransition(async () => {
      try {
        await fn();
        setToast(message);
        after?.();
        router.refresh();
      } catch (e) {
        setItems(initialItems);
        setToast(e instanceof Error ? e.message : "Une erreur est survenue.");
      }
    });
  }

  // ----- Filtres -----
  const sportChips = useMemo(() => {
    const set = new Set<string>();
    athletes.forEach((a) => a.sports.forEach((s) => set.add(s)));
    return SPORTS.filter((s) => set.has(s.value));
  }, [athletes]);
  const vis = athletes.filter(
    (a) => (sport === "all" || a.sports.includes(sport)) && (!q || a.fullName.toLowerCase().includes(q.toLowerCase()))
  );
  const athleteById = (id: string) => athletes.find((a) => a.id === id);

  // ----- Période affichée -----
  const visDays = Array.from({ length: 7 }, (_, i) => dayAt(fi + i));
  const inVis = (d: string) => d >= visDays[0] && d <= visDays[6];
  const m0 = dayAt(7 * mi);
  const m4 = dayAt(7 * mi + 34);
  let heading: string;
  let sub: string;
  if (view === "week") {
    const a = parse(visDays[0]);
    const b = parse(visDays[6]);
    heading = `${a.getDate()}${a.getMonth() !== b.getMonth() ? ` ${ML[a.getMonth()]}` : ""} – ${b.getDate()} ${ML[b.getMonth()]}`;
    const shown = items.filter((x) => inVis(x.date) && !x.isGoal && vis.some((a) => a.id === x.athleteId));
    sub = `Semaine ${isoWeek(visDays[3])} · ${vis.length} athlète${vis.length > 1 ? "s" : ""} · ${shown.length} séance${shown.length > 1 ? "s" : ""} programmée${shown.length > 1 ? "s" : ""} · ${shown.filter((x) => x.status === "done").length} faite${shown.filter((x) => x.status === "done").length > 1 ? "s" : ""}`;
  } else {
    heading = `${frs(m0)} – ${frs(m4)}`;
    sub = `Semaines ${isoWeek(m0)} à ${isoWeek(m4)} · ${vis.length} athlète${vis.length > 1 ? "s" : ""}`;
  }

  // Index par case athlète|jour
  const byCell = useMemo(() => {
    const m = new Map<string, PlanItem[]>();
    for (const x of items) {
      const k = `${x.athleteId}|${x.date}`;
      const l = m.get(k);
      if (l) l.push(x);
      else m.set(k, [x]);
    }
    for (const l of m.values()) l.sort((p, r) => Number(r.isGoal) - Number(p.isGoal));
    return m;
  }, [items]);
  const blockByCell = useMemo(() => {
    const m = new Map<string, PlanBlock>();
    for (const b of blocks) if (!m.has(`${b.athleteId}|${b.date}`)) m.set(`${b.athleteId}|${b.date}`, b);
    return m;
  }, [blocks]);

  // ----- Actions -----
  function drop(athleteId: string, date: string) {
    const id = drag;
    setDrag(null);
    setOver(null);
    const x = items.find((y) => y.id === id);
    if (!x || (x.athleteId === athleteId && x.date === date)) return;
    setItems((prev) => prev.map((y) => (y.id === x.id ? { ...y, athleteId, date } : y)));
    const who = athleteById(athleteId)?.name ?? "";
    run(
      () => planningMoveWorkoutAction({ workoutId: x.id, athleteId, date }),
      `« ${x.title} » déplacée ${x.athleteId !== athleteId ? `vers ${who}, ` : ""}${dayLong(date)}`
    );
    setPanel({ type: "item", id: x.id });
  }
  function openNew(athleteId: string, date: string) {
    const a = athleteById(athleteId);
    setEdit(false);
    setErr("");
    setForm({ title: "", sport: a ? guessSport(a) : "cycling", minutes: "60", date });
    setPanel((p) => (p?.type === "new" && p.athleteId === athleteId && p.date === date ? null : { type: "new", athleteId, date }));
  }
  function openItem(id: string) {
    setEdit(false);
    setDup([]);
    setPanel((p) => (p?.type === "item" && p.id === id ? null : { type: "item", id }));
  }
  function copyVisible(a: PlanAthlete) {
    const n = items.filter((x) => x.athleteId === a.id && inVis(x.date) && x.mine).length;
    if (!n) {
      setToast(`Aucune séance de ${a.name} à copier sur ces 7 jours`);
      return;
    }
    run(
      () => copyWeekAction({ athleteId: a.id, sourceWeekStart: visDays[0], targetWeekStart: addDays(visDays[0], 7) }),
      `${n} séance${n > 1 ? "s" : ""} de ${a.name} copiée${n > 1 ? "s" : ""} du ${frs(addDays(visDays[0], 7))} au ${frs(addDays(visDays[6], 7))}`
    );
  }

  // Brouillons de ce coach sur la période affichée (athlètes filtrés).
  const drafts = items.filter(
    (x) => x.isDraft && x.mine && vis.some((a) => a.id === x.athleteId) && (view === "week" ? inVis(x.date) : x.date >= m0 && x.date <= m4)
  );

  const cur = panel?.type === "item" ? items.find((x) => x.id === panel.id) ?? null : null;
  const newCell = panel?.type === "new" ? panel : null;

  // ----- Rendu -----
  const btnSmall = "rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-semibold text-moss whitespace-nowrap";
  const btnPrimary = "rounded-full bg-moss px-4 py-2 text-[13px] font-semibold text-white whitespace-nowrap disabled:opacity-50";
  const input = "w-full rounded-[10px] border border-line bg-white px-2.5 py-2 text-sm text-ink";
  const label = "flex min-w-0 flex-col gap-1.5 text-[12.5px] font-semibold text-slate";
  const arrow = "flex h-[34px] w-[34px] items-center justify-center rounded-full border border-line bg-white text-moss";
  const colWidth = view === "week" ? "max(120px, calc(100cqw / 7))" : "max(150px, calc(100cqw / 5))";

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-ink">{heading}</h1>
          <p className="text-sm text-slate">{sub}</p>
        </div>
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => jump(view === "week" ? todayMon : todayMon / 7 - 1)} className={btnSmall}>
            Aujourd&apos;hui
          </button>
          <button type="button" aria-label="Précédent" onClick={() => jump((view === "week" ? fi : mi) - per)} className={arrow}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>
          </button>
          <button type="button" aria-label="Suivant" onClick={() => jump((view === "week" ? fi : mi) + per)} className={arrow}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>
          </button>
          <div className="ml-1.5 flex rounded-full bg-paper-dim p-[3px]">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => switchView(v)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${view === v ? "bg-white text-ink shadow-sm" : "text-slate"}`}
              >
                {v === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[#9fb9b8] bg-white px-4 py-2.5 text-sm text-ink-soft">
          <span className="flex-1">
            <b className="text-ink">
              {drafts.length} brouillon{drafts.length > 1 ? "s" : ""}
            </b>{" "}
            sur {view === "week" ? "ces 7 jours" : "ces 5 semaines"}, pas encore visible{drafts.length > 1 ? "s" : ""} par les athlètes.
          </span>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              const ids = drafts.map((x) => x.id);
              setItems((prev) => prev.map((y) => (ids.includes(y.id) ? { ...y, isDraft: false } : y)));
              run(() => publishWorkoutsAction(ids), ids.length > 1 ? `${ids.length} séances publiées` : "Séance publiée");
            }}
          >
            {drafts.length > 1 ? `Tout publier (${drafts.length})` : "Publier"}
          </button>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un athlète"
          className="w-[220px] rounded-full border border-line bg-white px-3.5 py-2 text-[13.5px]"
        />
        {[{ value: "all", label: "Tous" }, ...sportChips].map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSport(s.value)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${sport === s.value ? "border-moss bg-moss text-white" : "border-line bg-white text-ink-soft"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {athletes.length === 0 ? (
        <section className="rounded-2xl bg-white p-6 text-sm text-slate">
          Aucun athlète actif pour l&apos;instant. Invitez vos athlètes depuis{" "}
          <Link href="/coach/dashboard" className="font-semibold text-moss underline">
            Mes athlètes
          </Link>
          .
        </section>
      ) : (
        <section className="flex flex-col rounded-2xl bg-white px-3 pb-3 pt-2">
          <div className="flex items-stretch">
            {/* Colonne fixe : athlètes */}
            <div className="flex w-[124px] shrink-0 flex-col sm:w-[190px]">
              <div className="flex h-[50px] items-center pl-2 text-[12.5px] text-slate">Athlète</div>
              {vis.map((a) => (
                <div
                  key={a.id}
                  className="flex min-w-0 items-center gap-2.5 border-t border-[#eef1f0] pl-2"
                  style={{ height: view === "week" ? ROW_H : MROW_H }}
                >
                  <Avatar userId={a.id} firstName={a.name} hasAvatar={!!a.avatarPath} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/coach/athletes/${a.id}`} title="Ouvrir la fiche" className="truncate text-sm font-bold text-ink hover:underline">
                      {a.name}
                    </Link>
                    {view === "month" && <span className="truncate text-xs text-slate">{a.sports.map((s) => SPORT_LABEL[s] ?? s).join(", ")}</span>}
                  </div>
                  {view === "week" && (
                    <button
                      type="button"
                      onClick={() => copyVisible(a)}
                      title="Copier ces 7 jours sur les 7 suivants"
                      aria-label={`Copier les 7 jours de ${a.name}`}
                      className="hidden pr-2 text-[#7a8480] hover:text-moss sm:flex"
                    >
                      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="6.5" y="6.5" width="10" height="10" rx="2" /><path d="M13.5 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Frise qui défile */}
            <div
              ref={stripRef}
              onScroll={onScroll}
              className="min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [container-type:inline-size] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex w-max">
                {view === "week"
                  ? Array.from({ length: nd }, (_, i) => {
                      const d = dayAt(i);
                      const isToday = d === today;
                      const goals = items.filter((x) => x.isGoal && x.date === d && vis.some((a) => a.id === x.athleteId));
                      const first = parse(d).getDate() === 1;
                      return (
                        <div
                          key={d}
                          className="shrink-0 snap-start"
                          style={{ width: colWidth, borderLeft: dow(d) === 0 ? "1.5px solid #dfe5e3" : "1px solid #f1f3f2", background: isToday ? "#fffaf7" : "transparent" }}
                        >
                          <div className="flex h-[50px] min-w-0 flex-col justify-center gap-[3px] px-2">
                            <span className={`whitespace-nowrap text-[12.5px] ${isToday ? "font-bold text-[#a4492a]" : "font-semibold text-slate"}`}>
                              {DN[dow(d)]} {parse(d).getDate()}
                              {first ? ` ${MS[parse(d).getMonth()]}` : ""}
                            </span>
                            {goals.map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => openItem(g.id)}
                                title={`${g.title} — ${athleteById(g.athleteId)?.name ?? ""}${d >= today ? ` · J-${diffDays(today, d)}` : ""}`}
                                className="max-w-full truncate rounded-full bg-[#fbe9e2] px-2 py-0.5 text-left text-[11px] font-bold text-[#a4492a]"
                              >
                                ◆ {g.title}
                              </button>
                            ))}
                          </div>
                          {vis.map((a) => {
                            const key = `${a.id}|${d}`;
                            const list = byCell.get(key) ?? [];
                            const block = blockByCell.get(key);
                            const shown = list.slice(0, block || list[0]?.isGoal ? 1 : 2);
                            const isNew = newCell?.athleteId === a.id && newCell.date === d;
                            const isOver = over === key;
                            return (
                              <div
                                key={key}
                                onClick={() => !list.length && openNew(a.id, d)}
                                onDragOver={(e) => {
                                  if (!drag) return;
                                  e.preventDefault();
                                  if (over !== key) setOver(key);
                                }}
                                onDragLeave={() => over === key && setOver(null)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  drop(a.id, d);
                                }}
                                className={`flex flex-col justify-center gap-[5px] overflow-hidden rounded-lg border-t border-[#eef1f0] px-1.5 py-[5px] ${list.length ? "" : "cursor-pointer hover:bg-[#f5f8f7]"}`}
                                style={{
                                  height: ROW_H,
                                  background: isOver ? "#d8ebe8" : isNew ? "#e3eeed" : undefined,
                                  outline: isOver || isNew ? "1.5px dashed #1b4b4f" : undefined,
                                  outlineOffset: -3,
                                }}
                              >
                                {shown.map((x) => {
                                  const sel = cur?.id === x.id;
                                  const w = x.isGoal ? 40 : Math.max(10, Math.min(60, Math.round((x.minutes / 240) * 60)));
                                  return (
                                    <div
                                      key={x.id}
                                      draggable={x.mine && !x.isGoal}
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData("text/plain", x.id);
                                        e.dataTransfer.effectAllowed = "move";
                                        setDrag(x.id);
                                      }}
                                      onDragEnd={() => {
                                        setDrag(null);
                                        setOver(null);
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openItem(x.id);
                                      }}
                                      title={`${x.title} · ${x.isGoal ? "Objectif" : `${x.sportLabel} · ${hm(x.minutes)}`}${x.isDraft ? " · brouillon" : ""}`}
                                      className={`-mx-[5px] flex min-w-0 flex-col gap-[3px] rounded-md px-[5px] py-[3px] ${x.mine && !x.isGoal ? "cursor-grab" : "cursor-pointer"}`}
                                      style={{
                                        background: sel ? "#ffffff" : "transparent",
                                        boxShadow: sel ? "0 2px 8px rgba(24,34,32,0.18)" : "none",
                                        opacity: drag === x.id ? 0.35 : x.isDraft ? 0.6 : 1,
                                      }}
                                    >
                                      <span className={`truncate text-[11.5px] font-semibold ${x.isGoal ? "text-[#a4492a]" : "text-ink"}`}>{x.title}</span>
                                      <div className="flex min-w-0 items-center gap-[5px]">
                                        <div
                                          className="h-2 shrink-0 rounded"
                                          style={{
                                            width: `${w}%`,
                                            background: x.status === "todo" ? "#ffffff" : COLOR[x.status],
                                            border: `1.5px ${x.status === "todo" ? "dashed" : "solid"} ${COLOR[x.status]}`,
                                          }}
                                        />
                                        <span className="whitespace-nowrap text-[10.5px] text-slate">{x.isGoal ? "Objectif" : x.minutes ? hm(x.minutes) : "—"}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {list.length > shown.length && (
                                  <span className="text-[11px] font-semibold text-slate">
                                    + {list.length - shown.length} autre{list.length - shown.length > 1 ? "s" : ""}
                                  </span>
                                )}
                                {block && (
                                  <span className="shrink-0 truncate rounded-md bg-[repeating-linear-gradient(135deg,#f3ece6_0,#f3ece6_6px,#faf6f2_6px,#faf6f2_12px)] px-1.5 py-[3px] text-[10.5px] leading-tight text-[#7a6a5c]">
                                    {block.label}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  : Array.from({ length: nw }, (_, k) => {
                      const w0 = dayAt(7 * k);
                      const w6 = addDays(w0, 6);
                      const isCur = w0 <= today && today <= w6;
                      return (
                        <div key={w0} className="shrink-0 snap-start px-1" style={{ width: colWidth }}>
                          <div className="flex h-[50px] items-center px-1.5">
                            <span className={`whitespace-nowrap text-[12.5px] ${isCur ? "font-bold text-[#a4492a]" : "font-semibold text-slate"}`}>
                              S{isoWeek(w0)} · {frs(w0)}
                            </span>
                          </div>
                          {vis.map((a) => {
                            const xs = items.filter((x) => x.athleteId === a.id && x.date >= w0 && x.date <= w6);
                            const plan = xs.reduce((t, x) => t + x.minutes, 0);
                            const done = xs.reduce((t, x) => t + (x.isGoal ? 0 : x.doneMinutes), 0);
                            const g = xs.find((x) => x.isGoal);
                            const n = xs.filter((x) => !x.isGoal).length;
                            return (
                              <div key={a.id} className="border-t border-[#eef1f0] py-[5px]" style={{ height: MROW_H }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFi(Math.max(0, Math.min(nd - 7, 7 * k)));
                                    setPanel(null);
                                    setView("week");
                                  }}
                                  title="Ouvrir la semaine"
                                  className="grid h-full w-full grid-cols-[14px_minmax(0,1fr)] items-end gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left"
                                  style={{ background: isCur ? "#fffaf7" : "#f7f9f8", border: `1.5px solid ${isCur ? "#e8c9bd" : "transparent"}` }}
                                >
                                  <div className="flex h-12 w-3.5 items-end overflow-hidden rounded bg-paper-dim">
                                    <div className="relative w-full overflow-hidden rounded bg-[#9fc3c4]" style={{ height: `${Math.max(4, Math.min(100, Math.round((plan / 720) * 100)))}%` }}>
                                      <div className="absolute inset-x-0 bottom-0 bg-moss" style={{ height: plan ? `${Math.min(100, Math.round((done / plan) * 100))}%` : "0%" }} />
                                    </div>
                                  </div>
                                  <div className="flex min-w-0 flex-col gap-0.5">
                                    <b className="text-[15px] text-ink">{hm(plan)}</b>
                                    <span className="text-xs text-slate">
                                      {n} séance{n > 1 ? "s" : ""}
                                    </span>
                                    {g && <span className="truncate text-[11.5px] font-bold text-[#a4492a]">◆ {g.title}</span>}
                                  </div>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
              </div>
            </div>

            {/* Colonne fixe : total des 7 jours visibles */}
            {view === "week" && (
              <div className="hidden w-[76px] shrink-0 flex-col sm:flex">
                <div className="flex h-[50px] items-center justify-end text-[12.5px] text-slate">7 jours</div>
                {vis.map((a) => (
                  <div key={a.id} className="flex items-center justify-end border-t border-[#eef1f0]" style={{ height: ROW_H }}>
                    <b className="text-[13px] text-ink">{hm(items.filter((x) => x.athleteId === a.id && inVis(x.date)).reduce((t, x) => t + x.minutes, 0))}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
          {vis.length === 0 && <p className="px-2 py-4 text-sm text-slate">Aucun athlète ne correspond.</p>}
          {view === "month" && (
            <div className="flex flex-wrap gap-4 px-2 pt-2.5 text-xs text-slate">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-[#9fc3c4]" />Volume prévu</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-moss" />Part réalisée</span>
              <span>Faites glisser pour changer de semaines · un clic sur une semaine l&apos;ouvre en détail</span>
            </div>
          )}
        </section>
      )}

      {/* Légende */}
      {view === "week" && !panel && athletes.length > 0 && (
        <div className="flex flex-col gap-2.5 px-0.5 text-xs text-slate">
          <div className="flex flex-wrap gap-[18px]">
            {(["done", "part", "miss", "todo", "goal"] as PlanStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-[22px] rounded"
                  style={{ background: s === "todo" ? "#ffffff" : COLOR[s], border: `1.5px ${s === "todo" ? "dashed" : "solid"} ${COLOR[s]}` }}
                />
                {s === "done" ? "Faite" : s === "part" ? "Partielle" : s === "miss" ? "Non faite" : STATUS_LABEL[s]}
              </span>
            ))}
            <span>La longueur de la barre suit la durée</span>
          </div>
          <span>
            Faites glisser la frise pour changer de jours · glissez une séance pour la déplacer (autre jour ou autre athlète) · clic sur une case
            vide pour en créer une · clic sur une séance pour le détail
          </span>
        </div>
      )}

      {/* Nouvelle séance */}
      {newCell && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#dfe5e3] bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <b className="text-[17px] text-ink">Nouvelle séance</b>
            <span className="text-[13px] text-slate">
              {athleteById(newCell.athleteId)?.name} · {dayLong(newCell.date)}
            </span>
            <span className="flex-1" />
            <CloseButton onClick={() => setPanel(null)} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12.5px] text-slate">Modèles</span>
            {PRESETS.map(([t, m]) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, title: t, minutes: String(m) }))}
                className="rounded-full border border-line bg-[#f7f9f8] px-2.5 py-1 text-[12.5px] font-semibold text-ink-soft"
              >
                {t} · {hm(m)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className={label}>
              Titre
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex. Seuil 3 × 10 min" className={input} />
            </label>
            <SportSelect value={form.sport} onChange={(v) => setForm({ ...form, sport: v })} label={label} input={input} />
            <DurationSelect value={form.minutes} onChange={(v) => setForm({ ...form, minutes: v })} label={label} input={input} />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                const title = form.title.trim();
                if (!title) {
                  setErr("Donnez un titre à la séance.");
                  return;
                }
                setErr("");
                const who = athleteById(newCell.athleteId)?.name ?? "";
                run(
                  () =>
                    createWorkoutAction({
                      athleteId: newCell.athleteId,
                      sport: form.sport,
                      category: "entrainement",
                      title,
                      dates: [newCell.date],
                      durationMinutes: Number(form.minutes) || 60,
                    }),
                  `Séance ajoutée pour ${who}`,
                  () => setPanel(null)
                );
              }}
            >
              Ajouter
            </button>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            {err && <span className="text-[#a4492a]">{err}</span>}
            <span className="flex-1" />
            <Link href={`/coach/athletes/${newCell.athleteId}/new-workout?date=${newCell.date}`} className="font-semibold text-slate hover:text-moss">
              Éditeur complet →
            </Link>
          </div>
        </section>
      )}

      {/* Détail d'une séance */}
      {cur && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[#dfe5e3] bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-[38px] w-1 rounded-sm" style={{ background: COLOR[cur.status] }} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <b className="text-[17px] text-ink">{cur.title}</b>
              <span className="text-[13px] text-slate">
                {athleteById(cur.athleteId)?.name} · {dayLong(cur.date)} · {cur.isGoal ? "Objectif" : cur.sportLabel}
                {!cur.isGoal && !edit ? ` · ${hm(cur.minutes)}` : ""}
                {!cur.isGoal && <> · <b className="text-ink-soft">{STATUS_LABEL[cur.status]}</b></>}
                {cur.isDraft ? " · brouillon" : ""}
              </span>
            </div>
            <span className="flex-1" />
            <CloseButton onClick={() => setPanel(null)} />
          </div>

          {edit ? (
            <div className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className={label}>
                Titre
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} />
              </label>
              <SportSelect value={form.sport} onChange={(v) => setForm({ ...form, sport: v })} label={label} input={input} />
              <DurationSelect value={form.minutes} onChange={(v) => setForm({ ...form, minutes: v })} label={label} input={input} />
              <label className={label}>
                Date
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} />
              </label>
              <div className="flex items-center gap-2 pb-1">
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    if (!form.title.trim()) return;
                    const patch = { title: form.title.trim(), sport: form.sport, sportLabel: SPORT_LABEL[form.sport] ?? form.sport, minutes: Number(form.minutes) || cur.minutes, date: form.date || cur.date };
                    setItems((prev) => prev.map((y) => (y.id === cur.id ? { ...y, ...patch } : y)));
                    setEdit(false);
                    run(
                      () => planningUpdateWorkoutAction({ workoutId: cur.id, title: patch.title, sport: patch.sport, durationMinutes: patch.minutes, date: patch.date }),
                      "Séance modifiée"
                    );
                  }}
                >
                  Enregistrer
                </button>
                <button type="button" onClick={() => setEdit(false)} className="text-[13px] font-semibold text-slate">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {cur.mine && cur.isDraft && (
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      setItems((prev) => prev.map((y) => (y.id === cur.id ? { ...y, isDraft: false } : y)));
                      run(() => publishWorkoutAction(cur.id), `« ${cur.title} » publiée`);
                    }}
                  >
                    Publier
                  </button>
                )}
                {cur.mine && !cur.isGoal && (
                  <>
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => {
                        setForm({ title: cur.title, sport: cur.sport, minutes: String(cur.minutes || 60), date: cur.date });
                        setEdit(true);
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className={btnSmall}
                      onClick={() => run(() => duplicateWorkoutAction({ workoutId: cur.id, targetDate: addDays(cur.date, 7) }), `Copiée au ${frs(addDays(cur.date, 7))}`)}
                    >
                      Copier la semaine suivante
                    </button>
                  </>
                )}
                <Link href={`/workouts/${cur.id}`} className={btnSmall}>
                  Ouvrir la séance
                </Link>
                <Link href={`/coach/athletes/${cur.athleteId}`} className={btnSmall}>
                  Calendrier de {athleteById(cur.athleteId)?.name}
                </Link>
                <span className="flex-1" />
                {cur.mine && (
                  <button
                    type="button"
                    className={`${btnSmall} !text-[#a4492a]`}
                    onClick={() => {
                      const t = cur.title;
                      setItems((prev) => prev.filter((y) => y.id !== cur.id));
                      setPanel(null);
                      run(() => planningDeleteWorkoutAction(cur.id), `« ${t} » supprimée`);
                    }}
                  >
                    Supprimer
                  </button>
                )}
              </div>
              {cur.mine && !cur.isGoal && athletes.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[#eef1f0] pt-3">
                  <span className="mr-1 text-[13px] font-semibold text-ink-soft">Dupliquer le même jour pour</span>
                  {athletes
                    .filter((a) => a.id !== cur.athleteId)
                    .map((a) => {
                      const on = dup.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setDup((d) => (on ? d.filter((x) => x !== a.id) : [...d, a.id]))}
                          className={`rounded-full border px-2.5 py-1 text-[12.5px] font-semibold ${on ? "border-moss bg-moss text-white" : "border-line bg-white text-ink-soft"}`}
                        >
                          {a.name}
                        </button>
                      );
                    })}
                  <button
                    type="button"
                    disabled={!dup.length}
                    className={`${btnPrimary} ml-1`}
                    onClick={() => {
                      const ids = dup;
                      const names = ids.map((i) => athleteById(i)?.name).join(", ");
                      setDup([]);
                      run(
                        () => Promise.all(ids.map((targetAthleteId) => duplicateWorkoutAction({ workoutId: cur.id, targetDate: cur.date, targetAthleteId }))),
                        `Dupliquée pour ${names}`
                      );
                    }}
                  >
                    Dupliquer ({dup.length})
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-ink px-[18px] py-[11px] text-[13.5px] font-semibold text-white shadow-[0_10px_30px_rgba(24,34,32,0.3)]">
          {toast}
        </div>
      )}
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Fermer"
      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-line bg-white text-slate"
    >
      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
    </button>
  );
}

function SportSelect({ value, onChange, label, input }: { value: string; onChange: (v: string) => void; label: string; input: string }) {
  return (
    <label className={label}>
      Sport
      <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
        {SPORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DurationSelect({ value, onChange, label, input }: { value: string; onChange: (v: string) => void; label: string; input: string }) {
  const opts = DURATIONS.includes(Number(value)) ? DURATIONS : [...DURATIONS, Number(value)].sort((a, b) => a - b);
  return (
    <label className={label}>
      Durée
      <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
        {opts.map((m) => (
          <option key={m} value={String(m)}>
            {hm(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
