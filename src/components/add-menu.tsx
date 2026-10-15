"use client";

import { useEffect, useState } from "react";
import { DoneActivityForm, HealthReportForm, JournalNoteForm, PeriodForm, UnavailabilityForm } from "./add-forms";

type Choice = "done" | "health" | "unavailable" | "note" | "period";

const ICONS: Record<Choice, string> = {
  done: "M4.5 10.5l3.5 3.5 7.5-8",
  health: "M10 16.5s-6-3.6-6-8.2A3.3 3.3 0 0110 6.3a3.3 3.3 0 016 2c0 4.6-6 8.2-6 8.2z",
  unavailable: "M4.5 9h11v8h-11zM7 9V6.5a3 3 0 016 0V9",
  note: "M13.5 3.5l3 3L7 16l-4 1 1-4z",
  period: "M10 3.5s-4.5 5-4.5 8.2a4.5 4.5 0 009 0C14.5 8.5 10 3.5 10 3.5z",
};
const COLORS: Record<Choice, string> = { done: "#8a5a44", health: "#a4492a", unavailable: "#182220", note: "#1b4b4f", period: "#e8896a" };
const LABELS: Record<Choice, string> = {
  done: "Une séance que j'ai faite",
  health: "Blessure, maladie ou état",
  unavailable: "Une indisponibilité",
  note: "Une note dans mon journal",
  period: "Mes règles",
};
const TITLES: Record<Choice, string> = {
  done: "Séance faite",
  health: "Comment tu vas ?",
  unavailable: "Indisponibilité",
  note: "Note dans mon journal",
  period: "Mes règles",
};

function Icon({ d, size = 21 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// Onglet « + » : tout ce que l'athlète peut ajouter de lui-même. Le menu ne
// suppose aucune date : chaque formulaire la demande.
export function AddMenu({
  today,
  coachName,
  isFemale,
  variant,
}: {
  today: string;
  coachName: string;
  isFemale: boolean;
  variant: "tab" | "header";
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const choices: Choice[] = ["done", "health", "unavailable", "note", ...(isFemale ? (["period"] as Choice[]) : [])];

  useEffect(() => {
    if (!menuOpen && !choice) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setChoice(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, choice]);

  const close = () => {
    setMenuOpen(false);
    setChoice(null);
  };

  return (
    <>
      {variant === "tab" ? (
        <button
          type="button"
          aria-label={menuOpen ? "Fermer" : "Ajouter"}
          aria-expanded={menuOpen}
          onClick={() => (choice ? close() : setMenuOpen((v) => !v))}
          className="relative z-[60] -mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-full text-white shadow-[0_6px_16px_rgba(27,75,79,0.35)] transition-transform"
          style={{ background: menuOpen ? "#182220" : "#1b4b4f", transform: menuOpen ? "rotate(45deg)" : "none" }}
        >
          <Icon d="M10 4.5v11M4.5 10h11" size={24} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-moss-dark px-3 py-1.5 font-semibold text-white"
        >
          <Icon d="M10 4.5v11M4.5 10h11" size={16} />
          Ajouter
        </button>
      )}

      {menuOpen && !choice && (
        <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-ink/35" />
          <section
            aria-label="Ajouter"
            onClick={(e) => e.stopPropagation()}
            className={`absolute left-3 right-3 flex flex-col rounded-3xl bg-white px-4 pb-2.5 pt-4 shadow-2xl sm:left-auto sm:right-6 sm:w-[360px] ${
              variant === "tab" ? "bottom-[92px]" : "top-16"
            }`}
          >
            <b className="px-1 pb-1.5 text-lg text-ink">Ajouter</b>
            {choices.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setChoice(c)}
                className={`flex items-center gap-3.5 px-1 py-2.5 text-left text-ink ${i ? "border-t border-paper-dim" : ""}`}
              >
                <span className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-xl bg-paper-dim" style={{ color: COLORS[c] }}>
                  <Icon d={ICONS[c]} />
                </span>
                <b className="flex-1 text-[15.5px] font-semibold">{LABELS[c]}</b>
                <span className="text-slate">
                  <Icon d="M8 5l5 5-5 5" size={16} />
                </span>
              </button>
            ))}
          </section>
        </div>
      )}

      {choice && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/35 sm:items-center sm:p-6" onClick={close}>
          <section
            role="dialog"
            aria-label={TITLES[choice]}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white px-5 pb-7 pt-2.5 shadow-2xl sm:max-w-md sm:rounded-[26px]"
            style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}
          >
            <span className="mx-auto mb-3 block h-[5px] w-[38px] rounded-full bg-line sm:hidden" />
            <div className="mb-4 flex items-center">
              <h2 className="text-xl font-bold text-ink">{TITLES[choice]}</h2>
              <span className="flex-1" />
              <button type="button" aria-label="Fermer" onClick={close} className="-m-2 p-2 text-slate">
                <Icon d="M5 5l10 10M15 5L5 15" size={20} />
              </button>
            </div>
            {choice === "done" && <DoneActivityForm onDone={close} />}
            {choice === "unavailable" && <UnavailabilityForm onDone={close} />}
            {choice === "note" && <JournalNoteForm defaultDate={today} onDone={close} />}
            {choice === "period" && <PeriodForm defaultDate={today} onDone={close} />}
            {choice === "health" && <HealthReportForm defaultDate={today} coachName={coachName} onDone={close} />}
          </section>
        </div>
      )}
    </>
  );
}
