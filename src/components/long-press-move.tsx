"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  deleteAvailabilityBlockAction,
  deleteImportedActivityAction,
  moveAvailabilityBlockAction,
  moveImportedActivityAction,
  moveWorkoutAction,
  planningDeleteWorkoutAction,
} from "@/lib/actions";
import { deleteCalendarEventAction, moveCalendarEventAction } from "@/lib/calendar-event-actions";

// Déplacer d'un appui long, au doigt comme à la souris. Rester appuyé sur une
// séance, une activité, un événement ou une indisponibilité la « prend » :
// elle suit le doigt, le jour survolé (tout élément data-move-date) s'allume,
// et on la lâche sur le jour voulu — ou sur la poubelle qui apparaît en bas
// (confirmation avant de supprimer). Appui long sans bouger : l'élément reste
// sélectionné, il suffit alors de toucher le jour. Sans <MoveProvider>
// autour, <LongPressMove> ne fait rien.

export type MoveItem = { kind: "workout" | "activity" | "event" | "availability"; id: string; title: string; date: string };

type Drag = { item: MoveItem; ghost: HTMLElement; dx: number; dy: number; sx: number; sy: number; moved: boolean };

const Ctx = createContext<{ selected: MoveItem | null; select: (i: MoveItem | null) => void; startDrag: (i: MoveItem, el: HTMLElement, x: number, y: number) => void } | null>(null);

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const label = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const TRASH = "__trash__";

async function doMove(i: MoveItem, date: string) {
  if (i.kind === "workout") return moveWorkoutAction({ workoutId: i.id, date });
  if (i.kind === "activity") return moveImportedActivityAction(i.id, date);
  if (i.kind === "event") return moveCalendarEventAction(i.id, date);
  return moveAvailabilityBlockAction(i.id, date);
}

async function doDelete(i: MoveItem) {
  if (i.kind === "workout") return planningDeleteWorkoutAction(i.id);
  if (i.kind === "activity") return deleteImportedActivityAction(i.id);
  if (i.kind === "event") return deleteCalendarEventAction(i.id);
  return deleteAvailabilityBlockAction(i.id);
}

/** Jour (ou poubelle) sous le doigt. */
function targetAt(x: number, y: number): { el: HTMLElement; date: string } | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const trash = el?.closest<HTMLElement>("[data-move-trash]");
  if (trash) return { el: trash, date: TRASH };
  const day = el?.closest<HTMLElement>("[data-move-date]");
  return day ? { el: day, date: day.dataset.moveDate! } : null;
}

export function MoveProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelectedState] = useState<MoveItem | null>(null);
  const [dragging, setDragging] = useState<MoveItem | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MoveItem | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const drag = useRef<Drag | null>(null);
  const overEl = useRef<HTMLElement | null>(null);
  // Le clic qui suit le relâchement ne doit pas valoir choix du jour.
  const selectedAt = useRef(0);
  const setSelected = (i: MoveItem | null) => {
    selectedAt.current = Date.now();
    setSelectedState(i);
  };

  const flash = (text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 3500);
  };

  async function move(item: MoveItem, date: string) {
    if (date === item.date) return;
    setPending(true);
    try {
      await doMove(item, date);
      flash(`« ${item.title} » déplacé au ${label(date)}`);
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Déplacement impossible.", true);
    }
    setPending(false);
  }

  async function remove(item: MoveItem) {
    setConfirmDelete(null);
    setPending(true);
    try {
      await doDelete(item);
      flash(`« ${item.title} » supprimé`);
      router.refresh();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Suppression impossible.", true);
    }
    setPending(false);
  }

  function setOver(el: HTMLElement | null) {
    if (overEl.current === el) return;
    overEl.current?.removeAttribute("data-move-over");
    el?.setAttribute("data-move-over", "");
    overEl.current = el;
    setOverTrash(!!el?.hasAttribute("data-move-trash"));
  }

  function startDrag(item: MoveItem, el: HTMLElement, x: number, y: number) {
    const r = el.getBoundingClientRect();
    // Copie visuelle de l'élément, qui suit le doigt.
    const ghost = el.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      zIndex: "96",
      pointerEvents: "none",
      transform: "rotate(-2deg) scale(1.04)",
      boxShadow: "0 18px 40px rgba(24,34,32,.25)",
      borderRadius: "12px",
      background: "#fff",
      opacity: "0.96",
      transition: "transform 120ms",
    });
    document.body.appendChild(ghost);
    drag.current = { item, ghost, dx: x - r.left, dy: y - r.top, sx: x, sy: y, moved: false };
    navigator.vibrate?.(15);
    setDragging(item);
  }

  // Suivi du glisser au niveau de la page.
  useEffect(() => {
    if (!dragging) return;
    let raf = 0;
    const noScroll = (e: TouchEvent) => e.preventDefault();
    const move_ = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) d.moved = true;
      d.ghost.style.left = `${e.clientX - d.dx}px`;
      d.ghost.style.top = `${e.clientY - d.dy}px`;
      const t = targetAt(e.clientX, e.clientY);
      setOver(t?.el ?? null);
      // Défilement automatique près du haut et du bas de l'écran.
      cancelAnimationFrame(raf);
      const edge = 80;
      const speed = e.clientY < edge ? -(edge - e.clientY) / 4 : e.clientY > window.innerHeight - edge - 90 && !t?.el.hasAttribute("data-move-trash") ? (e.clientY - (window.innerHeight - edge - 90)) / 5 : 0;
      if (speed) {
        const step = () => {
          window.scrollBy(0, speed);
          raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      }
    };
    const up = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      const d = drag.current;
      drag.current = null;
      setOver(null);
      setDragging(null);
      if (!d) return;
      d.ghost.remove();
      if (!d.moved) {
        // Appui long sans glisser : sélection, puis toucher le jour.
        setSelected(d.item);
        return;
      }
      selectedAt.current = Date.now();
      const t = targetAt(e.clientX, e.clientY);
      if (!t) return;
      if (t.date === TRASH) setConfirmDelete(d.item);
      else move(d.item, t.date);
    };
    document.addEventListener("touchmove", noScroll, { passive: false });
    window.addEventListener("pointermove", move_);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("touchmove", noScroll);
      window.removeEventListener("pointermove", move_);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // Mode sélection : toucher un jour (ou la poubelle) pour y mettre l'élément.
  useEffect(() => {
    if (!selected) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-move-bar]")) return;
      e.preventDefault();
      e.stopPropagation();
      if (Date.now() - selectedAt.current < 600) return;
      const t = targetAt(e.clientX, e.clientY);
      if (!t) return;
      const item = selected;
      setSelected(null);
      if (t.date === TRASH) setConfirmDelete(item);
      else move(item, t.date);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const active = dragging ?? selected;

  return (
    <Ctx.Provider value={{ selected, select: setSelected, startDrag }}>
      {children}
      {active && (
        <style>{`[data-move-date]{outline:2px dashed #e8896a;outline-offset:-3px}[data-move-date][data-move-over]{outline:2.5px solid #1b4b4f;background:#e3eeed!important;transition:background 120ms}body{-webkit-user-select:none;user-select:none}`}</style>
      )}
      {typeof document !== "undefined" &&
        (active || toast || pending || confirmDelete) &&
        createPortal(
          <div data-move-bar className="fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-[97] flex flex-col items-center gap-2 px-3">
            {/* Poubelle : y lâcher l'élément pour le supprimer. */}
            {active && (
              <div
                data-move-trash
                className={`flex items-center gap-2 rounded-full border-2 border-dashed px-5 py-3 text-sm font-semibold transition-all ${
                  overTrash ? "scale-110 border-[#a4492a] bg-[#a4492a] text-white" : "border-[#a4492a]/50 bg-white text-[#a4492a]"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5" />
                </svg>
                {dragging ? "Lâcher ici pour supprimer" : "Poubelle"}
              </div>
            )}
            <div
              className={`flex max-w-[560px] items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl ${
                toast?.error && !active && !confirmDelete ? "bg-[#a4492a] text-white" : "bg-ink text-white"
              } ${dragging ? "hidden" : ""}`}
            >
              {confirmDelete ? (
                <>
                  <span className="min-w-0">
                    Supprimer <b>« {confirmDelete.title} »</b> ?
                  </span>
                  <button type="button" onClick={() => remove(confirmDelete)} className="shrink-0 rounded-full bg-[#a4492a] px-3 py-1.5 font-semibold">
                    Supprimer
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(null)} className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 font-semibold">
                    Annuler
                  </button>
                </>
              ) : selected ? (
                <>
                  <span className="min-w-0">
                    <b className="block truncate">« {selected.title} »</b>
                    <span className="text-white/75">Touche le jour où la mettre</span>
                  </span>
                  <button type="button" onClick={() => setSelected(null)} className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 font-semibold">
                    Annuler
                  </button>
                </>
              ) : pending ? (
                <span>Un instant…</span>
              ) : toast ? (
                <span>{toast.text}</span>
              ) : null}
            </div>
          </div>,
          document.body
        )}
    </Ctx.Provider>
  );
}

/** Enveloppe un élément du calendrier : un appui long le prend pour le déplacer. */
export function LongPressMove({ item, children, className }: { item: MoveItem; children: React.ReactNode; className?: string }) {
  const ctx = useContext(Ctx);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const self = useRef<HTMLDivElement>(null);
  if (!ctx) return <>{children}</>;
  const on = ctx.selected?.kind === item.kind && ctx.selected.id === item.id;
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  return (
    <div
      ref={self}
      className={className}
      style={{ WebkitTouchCallout: "none", touchAction: "pan-y", ...(on ? { outline: "2px solid #e8896a", outlineOffset: 2, borderRadius: 10 } : {}) }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        const x = e.clientX;
        const y = e.clientY;
        timer.current = setTimeout(() => {
          fired.current = true;
          timer.current = null;
          if (self.current) ctx.startDrag(item, self.current, x, y);
        }, 420);
      }}
      onPointerMove={(e) => {
        // Le doigt bouge avant l'appui long : c'est un défilement.
        if (timer.current && start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        // Le clic qui suit un appui long ne doit pas ouvrir l'élément.
        if (fired.current) {
          e.preventDefault();
          e.stopPropagation();
          fired.current = false;
        }
      }}
    >
      {children}
    </div>
  );
}
