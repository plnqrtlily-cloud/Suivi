"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertCoachNotesAction } from "@/lib/actions";
import { Panel, PanelTitle, primaryBtn, ghostBtn, linkBtn, fieldClass } from "./tab-ui";

// Entretien de départ : le coach note lui-même ce qu'il a recueilli, en texte
// libre, rubrique par rubrique. Visible du coach seulement.
const SECTIONS = [
  { key: "context", label: "Contexte et parcours sportif", placeholder: "Âge, métier, historique sportif, niveau, matériel…" },
  { key: "objectives", label: "Objectifs et échéances", placeholder: "Courses visées, dates, résultats espérés…" },
  { key: "constraints", label: "Disponibilités et contraintes", placeholder: "Heures par semaine, jours possibles, travail, famille, santé…" },
  { key: "strengths", label: "Points forts", placeholder: "" },
  { key: "weaknesses", label: "Points faibles", placeholder: "" },
] as const;
type Key = (typeof SECTIONS)[number]["key"];
export type InterviewNotes = Partial<Record<Key, string | null>> & { updated_at?: string | null };

const MS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const frs = (iso: string) => `${Number(iso.slice(8, 10))} ${MS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

export function InterviewPanel({ athleteId, firstName, notes }: { athleteId: string; firstName: string; notes: InterviewNotes | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const filled = SECTIONS.filter((s) => notes?.[s.key]?.trim());
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<Key, string>>(() => Object.fromEntries(SECTIONS.map((s) => [s.key, notes?.[s.key] ?? ""])) as Record<Key, string>);
  const [error, setError] = useState("");

  function save() {
    const fd = new FormData();
    fd.set("athleteId", athleteId);
    for (const s of SECTIONS) fd.set(s.key, values[s.key]);
    setError("");
    start(async () => {
      try {
        await upsertCoachNotesAction(fd);
        setEditing(false);
        router.refresh();
      } catch {
        setError("L'enregistrement a échoué. Réessaie dans un instant.");
      }
    });
  }

  return (
    <Panel className="flex flex-col gap-3">
      <PanelTitle
        title="Entretien"
        hint={notes?.updated_at && filled.length ? `Mis à jour le ${frs(notes.updated_at)}` : `Ce que tu as recueilli avec ${firstName}. Visible de toi seul.`}
        right={
          !editing && filled.length > 0 ? (
            <button type="button" className={linkBtn} onClick={() => setEditing(true)}>
              Modifier
            </button>
          ) : undefined
        }
      />

      {!editing && filled.length === 0 && (
        <button type="button" className={`${primaryBtn} self-start`} onClick={() => setEditing(true)}>
          Renseigner l&apos;entretien
        </button>
      )}

      {!editing && filled.length > 0 && (
        <dl className="flex flex-col gap-3">
          {filled.map((s) => (
            <div key={s.key}>
              <dt className="text-[12px] font-bold uppercase tracking-wider text-slate">{s.label}</dt>
              <dd className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-ink">{notes?.[s.key]}</dd>
            </div>
          ))}
        </dl>
      )}

      {editing && (
        <div className="flex flex-col gap-3">
          {SECTIONS.map((s) => (
            <label key={s.key} className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink">{s.label}</span>
              <textarea
                rows={s.key === "strengths" || s.key === "weaknesses" ? 2 : 3}
                value={values[s.key]}
                placeholder={s.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                className={fieldClass}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} className={primaryBtn} onClick={save}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" className={ghostBtn} onClick={() => setEditing(false)}>
              Annuler
            </button>
          </div>
          <p className="text-xs text-slate">
            Les sports, le genre, les mesures, les charges et les antécédents se renseignent sur la fiche (sous le nom, onglets Mesures et Santé) : l&apos;athlète les voit dans son profil.
          </p>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-[#a4492a]">{error}</p>}
    </Panel>
  );
}
