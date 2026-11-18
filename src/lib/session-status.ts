// Statut des séances, le même partout (calendriers coach et athlète,
// planification, page séance, journée). Repéré par une icône plutôt que par
// une couleur :
//   À faire  → flèche
//   Faite    → sablier (réalisée, en attente de validation du coach)
//   Validée  → coche
//   Pas faite→ croix
// Couleurs neutres : jamais de rouge qui culpabilise l'athlète.
export type SessionTone = "todo" | "done" | "validated" | "noreport" | "missed" | "postponed" | "hors";
export type StatusIconName = "arrow" | "hourglass" | "check" | "cross" | "question" | "postpone" | "plus";

const NEUTRAL = { fg: "#1b4b4f", bg: "#eef2f1", bar: "#9fb3b0" };
const MUTED = { fg: "#5b6660", bg: "#eef0ef", bar: "#c3cac6" };

export const SESSION_TONES: Record<SessionTone, { label: string; fg: string; bg: string; bar: string; icon: StatusIconName }> = {
  todo: { label: "À faire", ...NEUTRAL, icon: "arrow" },
  done: { label: "Faite", ...NEUTRAL, icon: "hourglass" },
  validated: { label: "Validée", ...NEUTRAL, icon: "check" },
  noreport: { label: "Pas de retour", ...MUTED, icon: "question" },
  missed: { label: "Pas faite", ...MUTED, icon: "cross" },
  postponed: { label: "Reportée", ...MUTED, icon: "postpone" },
  hors: { label: "Hors programme", ...MUTED, icon: "plus" },
};

/** Ton d'une séance à partir de son statut en base. */
export function workoutTone(w: { status: string; date?: string; coach_validated_at?: string | null }, today?: string): SessionTone {
  if (w.status === "done" || w.status === "partial") return w.coach_validated_at ? "validated" : "done";
  if (w.status === "not_done") return "missed";
  if (w.status === "postponed") return "postponed";
  if (today && w.date && w.date < today) return "noreport";
  return "todo";
}
