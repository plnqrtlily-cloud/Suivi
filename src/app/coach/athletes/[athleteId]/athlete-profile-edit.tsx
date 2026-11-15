"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGenderAction, setAthleteSportsAction } from "@/lib/actions";

const SPORTS = [
  { value: "cycling", label: "Vélo / VTT" },
  { value: "running", label: "Course à pied" },
  { value: "hiking", label: "Randonnée" },
  { value: "swimming", label: "Natation" },
  { value: "climbing", label: "Escalade" },
  { value: "strength", label: "Musculation" },
  { value: "other", label: "Autre" },
];
const GENDERS = [
  { value: "female", label: "Féminin" },
  { value: "male", label: "Masculin" },
  { value: "other", label: "Autre" },
  { value: "prefer_not_to_say", label: "Non précisé" },
];

// Profil de l'athlète renseigné par le coach lors de l'entretien de départ :
// sports pratiqués et genre (qui ouvre le suivi du cycle pour un profil
// féminin). L'athlète le consulte dans Moi › Mes infos.
export function AthleteProfileEdit({ athleteId, gender, sports }: { athleteId: string; gender: string | null; sports: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [g, setG] = useState(gender ?? "");
  const [sel, setSel] = useState<string[]>(sports);
  const [pending, start] = useTransition();
  const empty = !gender && sports.length === 0;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-semibold text-moss-dark hover:underline">
        {empty ? "Renseigner sports et genre" : "Modifier sports et genre"}
      </button>
    );
  }
  return (
    <form
      className="mt-2 flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-line bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fs = new FormData();
        fs.set("athleteId", athleteId);
        sel.forEach((s) => fs.append("sports", s));
        const fg = new FormData();
        fg.set("athleteId", athleteId);
        fg.set("gender", g);
        start(async () => {
          await Promise.all([setAthleteSportsAction(fs), setGenderAction(fg)]);
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink">Sports pratiqués</p>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => {
            const on = sel.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={on}
                onClick={() => setSel((p) => (on ? p.filter((x) => x !== s.value) : [...p, s.value]))}
                className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${on ? "border-moss bg-moss text-white" : "border-line bg-white text-ink-soft"}`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink">Genre</p>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((x) => (
            <button
              key={x.value}
              type="button"
              aria-pressed={g === x.value}
              onClick={() => setG(x.value)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${g === x.value ? "border-moss bg-moss text-white" : "border-line bg-white text-ink-soft"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate">Un profil féminin ouvre à l&apos;athlète le suivi de son cycle.</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded-full bg-moss px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 text-[13px] font-semibold text-slate">
          Annuler
        </button>
      </div>
    </form>
  );
}
