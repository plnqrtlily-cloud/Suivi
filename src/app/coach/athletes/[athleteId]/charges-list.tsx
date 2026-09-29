"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addExerciseMaxAction, deleteExerciseMaxAction } from "@/lib/actions";
import { DurationInput, formatDuration } from "@/components/duration-input";
import { estimateOneRm } from "@/lib/one-rm";
import type { ExerciseMax } from "@/lib/queries";

const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const frs = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MS[m - 1]} ${y}`;
};
const num = (v: number) => (Number.isInteger(v) ? String(v) : String(v).replace(".", ","));

function headline(m: ExerciseMax) {
  if (m.value_type === "temps") return formatDuration(m.value_kg);
  if (m.value_type === "repetitions") return `${m.value_kg} reps`;
  return `${num(estimateOneRm(m.value_kg, m.reps))} kg`;
}
function detail(m: ExerciseMax) {
  if (m.value_type === "charge" && m.reps && m.reps > 1) return `${num(m.value_kg)} kg × ${m.reps}`;
  return headline(m);
}
function kindOf(m: ExerciseMax) {
  if (m.value_type === "charge") return m.reps && m.reps > 1 ? "1RM estimé" : "testé";
  return m.value_type === "temps" ? "durée" : "répétitions";
}

const inputCls = "rounded-lg border border-line bg-white px-2 py-1 text-[13.5px] text-ink outline-none focus:border-moss";

/** Charges de référence : la dernière valeur par exercice, cliquable pour voir l'historique, modifier ou supprimer. */
export function ChargesList({ athleteId, maxes }: { athleteId: string; maxes: ExerciseMax[] }) {
  const router = useRouter();
  const [openEx, setOpenEx] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byExercise = new Map<string, ExerciseMax[]>();
  for (const m of maxes) {
    if (!byExercise.has(m.exercise_name)) byExercise.set(m.exercise_name, []);
    byExercise.get(m.exercise_name)!.push(m);
  }

  function saveEdit(e: React.FormEvent<HTMLFormElement>, m: ExerciseMax) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("exerciseName", m.exercise_name);
    fd.set("valueType", m.value_type);
    fd.set("replaceId", m.id);
    start(async () => {
      await addExerciseMaxAction(athleteId, fd);
      setEditing(null);
      router.refresh();
    });
  }
  function remove(m: ExerciseMax, left: number) {
    start(async () => {
      await deleteExerciseMaxAction(m.id, athleteId);
      setConfirm(null);
      if (left <= 1) setOpenEx(null);
      router.refresh();
    });
  }

  if (maxes.length === 0) return <p className="text-sm text-slate">Aucune charge renseignée.</p>;

  return (
    <div className="flex flex-col">
      {[...byExercise.entries()].map(([name, entries]) => {
        const last = entries[0];
        const open = openEx === name;
        return (
          <div key={name} className="flex flex-col border-t border-line first:border-t-0">
            <button
              type="button"
              onClick={() => {
                setOpenEx(open ? null : name);
                setEditing(null);
                setConfirm(null);
              }}
              className={`-mx-2 flex items-baseline justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-paper-dim ${open ? "bg-paper-dim" : ""}`}
            >
              <span className="text-ink-soft">{name}</span>
              <span className="text-right">
                <b className="font-semibold text-ink">{headline(last)}</b>
                <span className="ml-2.5 text-[13px] text-slate">
                  {kindOf(last)} · {frs(last.tested_at)}
                </span>
              </span>
            </button>
            {open && (
              <div className="relative mb-2 mt-2 animate-expand-in">
                <span className="absolute -top-[7px] left-6 h-3.5 w-3.5 rotate-45 border-l border-t border-line bg-paper" />
                <div className="flex flex-col gap-1 rounded-2xl border border-line bg-paper p-3.5">
                  <div className="flex items-center gap-2 pb-1">
                    <b className="text-[14.5px] text-ink">{name}</b>
                    <span className="text-xs text-slate">
                      {entries.length} mesure{entries.length > 1 ? "s" : ""}
                    </span>
                    <span className="flex-1" />
                    <button type="button" onClick={() => setOpenEx(null)} aria-label="Fermer" className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-slate">
                      ×
                    </button>
                  </div>
                  {entries.map((m) => (
                    <div key={m.id} className="border-t border-line/70 py-1.5 text-[13.5px]">
                      {editing === m.id ? (
                        <form onSubmit={(e) => saveEdit(e, m)} className="flex flex-wrap items-center gap-2">
                          <input type="date" name="testedAt" defaultValue={m.tested_at.slice(0, 10)} required className={`${inputCls} w-[140px]`} />
                          {m.value_type === "temps" ? (
                            <DurationInput name="value" defaultSeconds={m.value_kg} required />
                          ) : (
                            <>
                              <input
                                type="number"
                                name="value"
                                step={m.value_type === "charge" ? "0.5" : "1"}
                                defaultValue={m.value_kg}
                                required
                                aria-label={m.value_type === "charge" ? "Charge (kg)" : "Répétitions"}
                                className={`${inputCls} w-20`}
                              />
                              <span className="text-slate">{m.value_type === "charge" ? "kg ×" : "reps"}</span>
                            </>
                          )}
                          {m.value_type === "charge" && (
                            <>
                              <input type="number" name="reps" min={1} max={30} defaultValue={m.reps ?? 1} aria-label="Répétitions" className={`${inputCls} w-16`} />
                              <span className="text-slate">rép.</span>
                            </>
                          )}
                          <input name="note" defaultValue={m.note ?? ""} placeholder="Note" className={`${inputCls} min-w-[120px] flex-1`} />
                          <button type="submit" disabled={pending} className="rounded-full bg-moss px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
                            OK
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className="text-[12.5px] font-semibold text-slate">
                            Annuler
                          </button>
                        </form>
                      ) : confirm === m.id ? (
                        <div className="flex items-center gap-2.5">
                          <span className="text-ink-soft">Supprimer la mesure du {frs(m.tested_at)} ?</span>
                          <span className="flex-1" />
                          <button type="button" onClick={() => remove(m, entries.length)} disabled={pending} className="rounded-full bg-clay px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
                            Supprimer
                          </button>
                          <button type="button" onClick={() => setConfirm(null)} className="text-[12.5px] font-semibold text-slate">
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <span className="w-[110px] text-slate">{frs(m.tested_at)}</span>
                          <b className="text-ink">{detail(m)}</b>
                          {m.value_type === "charge" && m.reps && m.reps > 1 && <span className="text-xs text-slate">→ 1RM ≈ {num(estimateOneRm(m.value_kg, m.reps))} kg</span>}
                          {m.note && <span className="truncate text-xs text-ink-soft">{m.note}</span>}
                          <span className="flex-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(m.id);
                              setConfirm(null);
                            }}
                            aria-label="Modifier"
                            title="Modifier"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-moss-dark hover:bg-white"
                          >
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M13.5 3.5l3 3L7 16H4v-3z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirm(m.id);
                              setEditing(null);
                            }}
                            aria-label="Supprimer"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[17px] leading-none text-slate hover:bg-white hover:text-clay"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
