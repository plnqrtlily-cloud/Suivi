"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { placeFlexWorkoutAction } from "@/lib/actions";
import { sportTone } from "@/lib/palette";
import { sportIconPath } from "@/lib/sport-icons";

// Séances « à placer » d'une semaine : le coach les prépare, l'athlète les
// range dans sa semaine en les faisant glisser au doigt (ou à la souris) sur
// le jour de son choix. La carte suit le doigt, le jour survolé s'allume, la
// carte « tombe » dans sa case. On peut aussi toucher la séance puis le jour.
// Une séance placée se déplace encore (autre jour, ou retour dans le bac) tant
// qu'elle n'est pas renseignée. Le coach est prévenu à chaque fois.

export interface FlexItem {
  id: string;
  title: string;
  sportLabel: string;
  sport?: string;
  discipline?: string | null;
  durationMinutes: number | null;
  color: string;
  /** Jour choisi, ou null tant qu'elle attend dans le bac. */
  date: string | null;
  /** Encore déplaçable (séance pas encore renseignée). */
  movable: boolean;
}

export interface DayInfo {
  /** Autres séances ou activités déjà ce jour-là. */
  busy: number;
  /** Indisponibilité posée ce jour-là. */
  unavailable: boolean;
}

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const TRAY = "tray";

function minutes(m: number | null) {
  if (!m) return null;
  const h = Math.floor(m / 60);
  return h ? `${h} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`;
}

type Drag = { id: string; x: number; y: number; dx: number; dy: number; w: number; started: boolean; sx: number; sy: number };

export function PlaceTray({
  dates,
  today,
  items: initial,
  days,
  you = "toi",
}: {
  dates: string[];
  today: string;
  items: FlexItem[];
  days: Record<string, DayInfo>;
  /** Registre : l'athlète (« toi ») ou le coach qui place pour lui (« vous »). */
  you?: "toi" | "vous";
}) {
  // Placement optimiste : la case se remplit tout de suite, la base suit.
  const [items, setItems] = useState(initial);
  const [synced, setSynced] = useState(initial);
  if (initial !== synced) {
    setSynced(initial);
    setItems(initial);
  }
  const [selected, setSelected] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dragRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const waiting = items.filter((i) => !i.date);
  const placedCount = items.length - waiting.length;
  const sel = items.find((i) => i.id === selected) ?? null;
  const vous = you === "vous";

  function place(id: string, date: string | null) {
    const item = items.find((i) => i.id === id);
    setSelected(null);
    if (!item || !item.movable || item.date === date) return;
    const before = items;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, date } : i)));
    setLanded(id);
    setTimeout(() => setLanded((l) => (l === id ? null : l)), 500);
    navigator.vibrate?.(12);
    setError(null);
    startTransition(async () => {
      try {
        await placeFlexWorkoutAction(id, date);
      } catch (e) {
        setItems(before);
        setError(e instanceof Error ? e.message : "Impossible de placer la séance.");
      }
    });
  }

  // Cible sous le doigt : un élément [data-drop] de ce bac.
  function targetAt(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
    return el && root.current?.contains(el) ? el.dataset.drop! : null;
  }

  // Glisser : suivi au niveau du document (le doigt sort de la carte).
  useEffect(() => {
    if (!drag) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const started = d.started || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6;
      if (started && !d.started) navigator.vibrate?.(8);
      const next = { ...d, x: e.clientX, y: e.clientY, started };
      dragRef.current = next;
      setDrag(next);
      if (started) {
        setOver(targetAt(e.clientX, e.clientY));
        // Défilement automatique près des bords de l'écran.
        cancelAnimationFrame(raf);
        const edge = 70;
        const speed = e.clientY < edge ? -(edge - e.clientY) / 4 : e.clientY > window.innerHeight - edge ? (e.clientY - (window.innerHeight - edge)) / 4 : 0;
        if (speed) {
          const step = () => {
            window.scrollBy(0, speed);
            raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
        }
      }
    };
    const up = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setOver(null);
      if (!d || !d.started) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 50);
      const t = targetAt(e.clientX, e.clientY);
      if (t) place(d.id, t === TRAY ? null : t);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  const dragging = drag?.started ? items.find((i) => i.id === drag.id) ?? null : null;

  const card = (i: FlexItem, compact = false, floating = false) => {
    const tone = sportTone(i.sport ?? "other", i.discipline);
    const ghost = !floating && dragging?.id === i.id;
    return (
      <button
        key={i.id}
        type="button"
        tabIndex={floating ? -1 : undefined}
        onPointerDown={(e) => {
          if (!i.movable || e.button !== 0) return;
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const d = { id: i.id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, started: false };
          dragRef.current = d;
          setDrag(d);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (suppressClick.current || !i.movable) return;
          setSelected((s) => (s === i.id ? null : i.id));
        }}
        title={i.movable ? (vous ? "Glissez sur un jour, ou touchez puis choisissez le jour" : "Glisse sur un jour, ou touche puis choisis le jour") : "Séance déjà renseignée"}
        style={{ touchAction: i.movable ? "none" : undefined }}
        className={`flex w-full min-w-0 select-none items-center gap-2 rounded-xl border bg-white text-left transition-[box-shadow,opacity,transform] ${compact ? "px-1.5 py-1.5" : "px-2.5 py-2.5"} ${
          selected === i.id ? "border-[#1b4b4f] shadow-[0_0_0_3px_#1b4b4f26]" : "border-line shadow-sm"
        } ${floating ? "" : i.movable ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-70"} ${ghost ? "opacity-30" : ""} ${landed === i.id ? "animate-place-pop" : ""}`}
      >
        <span className={`flex flex-shrink-0 items-center justify-center rounded-lg ${compact ? "h-6 w-6" : "h-8 w-8"}`} style={{ background: tone.tint, color: tone.color }}>
          <svg width={compact ? 13 : 16} height={compact ? 13 : 16} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={sportIconPath(i.sport ?? "other")} />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold text-ink ${compact ? "text-[12px] leading-tight" : "text-[14px]"}`}>{i.title}</span>
          <span className={`block truncate text-slate ${compact ? "text-[10.5px]" : "text-[12px]"}`}>{[i.sportLabel, minutes(i.durationMinutes)].filter(Boolean).join(" · ")}</span>
        </span>
        {i.movable && !compact && (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="#9aa39c" aria-hidden className="flex-shrink-0">
            {[6, 10, 14].flatMap((y) => [7, 13].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" />))}
          </svg>
        )}
      </button>
    );
  };

  const hint = dragging
    ? vous ? "Lâchez sur le jour choisi" : "Lâche sur le jour choisi"
    : sel
      ? sel.date
        ? vous ? "Touchez un autre jour, ou le bac pour la retirer" : "Touche un autre jour, ou le bac pour la retirer"
        : vous ? "Touchez le jour choisi" : "Touche le jour choisi"
      : waiting.length
        ? vous ? "Faites glisser chaque séance sur un jour" : "Fais glisser chaque séance sur le jour de ton choix"
        : "";

  return (
    <div ref={root} className="rounded-[20px] border border-[#1b4b4f]/15 bg-[#f4f8f7] p-3 sm:p-3.5" onClick={() => setSelected(null)}>
      {/* En-tête et progression */}
      <div className="mb-2.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] text-ink">{waiting.length ? (vous ? "Séances à placer" : "Organise ta semaine") : vous ? "Séances placées" : "Semaine organisée ✓"}</b>
          <span className="block text-[12.5px] text-slate">{hint || (vous ? "Tout est placé. Glissez une séance pour la changer de jour." : "Bien joué ! Glisse une séance pour la changer de jour.")}</span>
        </div>
        <span className="flex-shrink-0 text-[13px] font-bold text-moss-dark">
          {placedCount}/{items.length}
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#dfe7e5]">
        <div className="h-full rounded-full bg-[#2f7d5b] transition-[width] duration-500" style={{ width: `${items.length ? (placedCount / items.length) * 100 : 0}%` }} />
      </div>

      {/* Bac : les séances qui attendent (et zone pour en retirer une). */}
      <div
        data-drop={TRAY}
        onClick={(e) => {
          e.stopPropagation();
          if (sel?.date) place(sel.id, null);
        }}
        className={`mb-3 rounded-2xl border-2 border-dashed p-2 transition-colors ${
          over === TRAY ? "border-[#1b4b4f] bg-[#e3eeed]" : (dragging?.date || sel?.date) ? "border-[#1b4b4f]/40 bg-white/60" : "border-transparent"
        } ${waiting.length === 0 && !dragging?.date && !sel?.date ? "hidden" : ""}`}
      >
        {waiting.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{waiting.map((i) => card(i))}</div>
        ) : (
          <p className="py-2 text-center text-[12.5px] font-semibold text-moss-dark">↩ {vous ? "Déposez ici pour remettre à placer" : "Dépose ici pour remettre à placer"}</p>
        )}
      </div>

      {/* Jours : grandes lignes sur téléphone, 7 colonnes sur ordinateur. */}
      <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-7 sm:gap-1.5">
        {dates.map((date, idx) => {
          const placed = items.filter((i) => i.date === date);
          const info = days[date] ?? { busy: 0, unavailable: false };
          const active = !!(dragging || sel);
          const isOver = over === date;
          return (
            <div
              key={date}
              data-drop={date}
              role="button"
              tabIndex={0}
              aria-label={`Placer le ${date}`}
              onClick={(e) => {
                e.stopPropagation();
                if (sel) place(sel.id, date);
              }}
              className={`flex min-w-0 items-center gap-2 rounded-xl border p-1.5 transition-all duration-150 sm:min-h-[96px] sm:flex-col sm:items-stretch ${
                isOver
                  ? "scale-[1.02] border-[#1b4b4f] bg-[#e3eeed] shadow-md"
                  : active
                    ? "border-dashed border-[#1b4b4f]/45 bg-white"
                    : "border-line bg-white/80"
              } ${info.unavailable && !isOver ? "bg-[repeating-linear-gradient(135deg,#f3ece6_0,#f3ece6_5px,#faf6f2_5px,#faf6f2_10px)]" : ""}`}
            >
              <span className={`flex w-12 flex-shrink-0 flex-col items-center leading-tight sm:w-auto sm:flex-row sm:justify-center sm:gap-1 ${date === today ? "text-[#a4492a]" : "text-slate"}`}>
                <span className="text-[11px] font-bold uppercase">{DOW[idx]}</span>
                <span className="text-[15px] font-bold sm:text-[11px]">{Number(date.slice(8))}</span>
              </span>
              <div className="flex min-h-[38px] min-w-0 flex-1 flex-col justify-center gap-1">
                {placed.map((i) => card(i, true))}
                {placed.length === 0 && (
                  <span className={`text-[11.5px] ${isOver ? "font-semibold text-moss-dark" : "text-[#9aa39c]"} sm:text-center`}>
                    {isOver ? (vous ? "Déposez ici" : "Dépose ici") : info.unavailable ? "Indispo" : info.busy ? `${info.busy} autre${info.busy > 1 ? "s" : ""} séance${info.busy > 1 ? "s" : ""}` : active ? "+" : "Libre"}
                  </span>
                )}
              </div>
              {placed.length > 0 && (info.busy > 0 || info.unavailable) && (
                <span className="flex-shrink-0 text-[10px] text-slate sm:text-center">{info.unavailable ? "Indispo" : `+${info.busy}`}</span>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-[12.5px] text-[#a4492a]">{error}</p>}

      {/* Carte qui suit le doigt. */}
      {dragging &&
        drag &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[95]"
            style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: Math.min(drag.w, 320), transform: "rotate(-2.5deg) scale(1.04)" }}
          >
            <div className="rounded-xl shadow-2xl">{card(dragging, false, true)}</div>
          </div>,
          document.body
        )}
    </div>
  );
}
