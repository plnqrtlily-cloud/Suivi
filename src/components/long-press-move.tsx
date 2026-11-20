"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { moveAvailabilityBlockAction, moveImportedActivityAction, moveWorkoutAction } from "@/lib/actions";
import { moveCalendarEventAction } from "@/lib/calendar-event-actions";

// Déplacer d'un appui long : rester appuyé sur une séance, une activité, un
// événement ou une indisponibilité la « prend en main » ; on touche ensuite le
// jour où la poser (tout élément marqué data-move-date). Au doigt comme à la
// souris. Sans <MoveProvider> autour, <LongPressMove> ne fait rien.

export type MoveItem = { kind: "workout" | "activity" | "event" | "availability"; id: string; title: string; date: string };

const Ctx = createContext<{ selected: MoveItem | null; select: (i: MoveItem | null) => void } | null>(null);

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const label = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

async function doMove(i: MoveItem, date: string) {
  if (i.kind === "workout") return moveWorkoutAction({ workoutId: i.id, date });
  if (i.kind === "activity") return moveImportedActivityAction(i.id, date);
  if (i.kind === "event") return moveCalendarEventAction(i.id, date);
  return moveAvailabilityBlockAction(i.id, date);
}

export function MoveProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelectedState] = useState<MoveItem | null>(null);
  // Le clic qui suit l'appui long (en relâchant) ne doit pas valoir choix du jour.
  const selectedAt = useRef(0);
  const setSelected = (i: MoveItem | null) => {
    selectedAt.current = Date.now();
    setSelectedState(i);
  };
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!selected) return;
    const onClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-move-bar]")) return;
      // Pendant la sélection, un toucher sert seulement à choisir le jour.
      e.preventDefault();
      e.stopPropagation();
      if (Date.now() - selectedAt.current < 600) return;
      const day = target.closest<HTMLElement>("[data-move-date]");
      if (!day) return;
      const date = day.dataset.moveDate!;
      const item = selected;
      setSelected(null);
      if (date === item.date) return;
      setPending(true);
      try {
        await doMove(item, date);
        setToast({ text: `« ${item.title} » déplacé au ${label(date)}` });
        router.refresh();
      } catch (err) {
        setToast({ text: err instanceof Error ? err.message : "Déplacement impossible.", error: true });
      }
      setPending(false);
      setTimeout(() => setToast(null), 3500);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [selected, router]);

  return (
    <Ctx.Provider value={{ selected, select: setSelected }}>
      {children}
      {selected && (
        <style>{`[data-move-date]{outline:2px dashed #e8896a;outline-offset:-3px;cursor:copy}[data-move-date]:hover{background:#fff4ee!important}`}</style>
      )}
      {(selected || toast || pending) &&
        createPortal(
          <div data-move-bar className="fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-[90] flex justify-center px-3">
            <div className={`flex max-w-[560px] items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-2xl ${toast?.error ? "bg-[#a4492a] text-white" : "bg-ink text-white"}`}>
              {selected ? (
                <>
                  <span className="min-w-0">
                    <b className="block truncate">« {selected.title} »</b>
                    <span className="text-white/75">Touchez le jour où le déplacer</span>
                  </span>
                  <button type="button" onClick={() => setSelected(null)} className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 font-semibold">
                    Annuler
                  </button>
                </>
              ) : pending ? (
                <span>Déplacement…</span>
              ) : (
                <span>{toast?.text}</span>
              )}
            </div>
          </div>,
          document.body
        )}
    </Ctx.Provider>
  );
}

/** Enveloppe un élément du calendrier : un appui long le sélectionne pour le déplacer. */
export function LongPressMove({ item, children, className }: { item: MoveItem; children: React.ReactNode; className?: string }) {
  const ctx = useContext(Ctx);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  if (!ctx) return <>{children}</>;
  const on = ctx.selected?.kind === item.kind && ctx.selected.id === item.id;
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  return (
    <div
      className={className}
      style={{ WebkitTouchCallout: "none", userSelect: "none", ...(on ? { outline: "2px solid #e8896a", outlineOffset: 2, borderRadius: 10 } : {}) }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          fired.current = true;
          ctx.select(item);
          navigator.vibrate?.(30);
        }, 450);
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
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
