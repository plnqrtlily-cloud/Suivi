"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { copyWorkoutToAthletesAction } from "@/lib/actions";
import { DaysPicker } from "@/components/days-picker";

// Copier-coller de séances côté coach : « Copier » garde la séance en mémoire
// (dans ce navigateur, même en changeant de page ou d'athlète), puis
// « Coller » sur un jour du calendrier de n'importe quel athlète la recrée,
// structure comprise. La séance reste copiée pour la coller plusieurs fois.

export interface CopiedWorkout {
  id: string;
  title: string;
  athleteName: string;
}

const KEY = "rythme.copiedWorkout";
const EVENT = "rythme:clipboard";

function read(): CopiedWorkout | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CopiedWorkout) : null;
  } catch {
    return null;
  }
}

export function setCopiedWorkout(w: CopiedWorkout | null) {
  try {
    if (w) window.localStorage.setItem(KEY, JSON.stringify(w));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Navigation privée stricte : le copier-coller reste limité à la page.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useCopiedWorkout(): CopiedWorkout | null {
  const [w, setW] = useState<CopiedWorkout | null>(null);
  useEffect(() => {
    const sync = () => setW(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return w;
}

/** Colle la séance copiée chez cet athlète, ce jour-là. */
export async function pasteWorkout(copied: CopiedWorkout, athleteId: string, date: string) {
  return copyWorkoutToAthletesAction({ workoutId: copied.id, athleteIds: [athleteId], dates: [date] });
}

export function CopyWorkoutButton({ workout, className }: { workout: CopiedWorkout; className?: string }) {
  const copied = useCopiedWorkout();
  const [flash, setFlash] = useState(false);
  const isCopied = copied?.id === workout.id;
  return (
    <button
      type="button"
      onClick={() => {
        setCopiedWorkout(workout);
        setFlash(true);
        setTimeout(() => setFlash(false), 2200);
      }}
      className={className ?? "text-sm font-semibold text-moss-dark hover:underline"}
      title="Puis « Coller » sur un jour du calendrier de n'importe quel athlète"
    >
      {flash ? "Copiée ✓" : isCopied ? "Copiée" : "Copier"}
    </button>
  );
}

/** Bandeau rappelant la séance copiée, avec de quoi vider le presse-papiers. */
export function ClipboardBar({ hint }: { hint: string }) {
  const copied = useCopiedWorkout();
  if (!copied) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-dashed border-[#1b4b4f]/40 bg-[#f4f8f7] px-4 py-2.5 text-sm">
      <span className="min-w-0 flex-1 text-ink-soft">
        <b className="text-ink">Séance copiée :</b> « {copied.title} »{copied.athleteName ? ` (de ${copied.athleteName})` : ""} · {hint}
      </span>
      <button type="button" onClick={() => setCopiedWorkout(null)} className="text-[13px] font-semibold text-slate hover:text-ink">
        Vider
      </button>
    </div>
  );
}

interface AthleteOption {
  athlete_id: string;
  first_name: string;
  last_name: string;
}

/** Envoi direct à un ou plusieurs athlètes, sur un ou plusieurs jours. */
export function SendToAthletesButton({
  workoutId,
  workoutTitle,
  athleteId,
  athleteName,
  date,
  athletes,
  className,
}: {
  className?: string;
  workoutId: string;
  workoutTitle: string;
  athleteId: string;
  athleteName: string;
  date: string;
  /** Les autres athlètes actifs du coach. */
  athletes: AthleteOption[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([date]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState<string | null>(null);
  const all: AthleteOption[] = [{ athlete_id: athleteId, first_name: athleteName, last_name: "" }, ...athletes];

  async function submit() {
    setPending(true);
    setError(undefined);
    try {
      const r = await copyWorkoutToAthletesAction({ workoutId, athleteIds: selected, dates });
      setDone(`${r.count} séance${r.count > 1 ? "s" : ""} créée${r.count > 1 ? "s" : ""}`);
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
    setPending(false);
  }

  return (
    <>
      <button type="button" onClick={() => (setOpen(true), setDone(null))} className={className ?? "text-sm font-semibold text-moss-dark hover:underline"}>
        Envoyer à un autre athlète…
      </button>
      {/* Hors du menu « ⋯ » (masqué une fois l'action choisie) : rendu sur la page. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/35 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Envoyer la séance"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full overflow-y-auto overscroll-contain rounded-t-[26px] bg-white px-5 pt-5 shadow-2xl sm:max-w-md sm:rounded-[26px]"
            style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
          >
            <h2 className="mb-1 text-xl font-bold text-ink">Envoyer « {workoutTitle} »</h2>
            <p className="mb-4 text-[13px] text-slate">La séance est recréée à l&apos;identique (structure, consignes) pour chaque athlète et chaque jour choisis.</p>
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Athlète(s)</span>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {all.map((a) => {
                const on = selected.includes(a.athlete_id);
                return (
                  <button
                    key={a.athlete_id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected((p) => (on ? p.filter((x) => x !== a.athlete_id) : [...p, a.athlete_id]))}
                    className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-moss-dark bg-moss-dark text-white" : "border-line bg-white text-ink-soft hover:border-moss"}`}
                  >
                    {`${a.first_name} ${a.last_name}`.trim()}
                    {a.athlete_id === athleteId ? " (même athlète)" : ""}
                  </button>
                );
              })}
            </div>
            <span className="mb-1.5 block text-sm font-medium text-ink-soft">Jour(s)</span>
            <DaysPicker value={dates} onChange={setDates} />
            {error && <p className="mt-3 text-sm text-[#a4492a]">{error}</p>}
            {done && <p className="mt-3 text-sm font-semibold text-moss-dark">✓ {done}. Les athlètes sont prévenus.</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={pending || !selected.length || !dates.length}
                onClick={submit}
                className="rounded-full bg-moss-dark px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {pending ? "Envoi…" : selected.length > 1 ? `Envoyer à ${selected.length} athlètes` : "Envoyer"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate hover:text-ink">
                Fermer
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
