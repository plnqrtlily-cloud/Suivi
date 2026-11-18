// Code couleur des séances, le même partout (calendriers coach et athlète,
// planification, page séance) :
//   À faire  → bleu
//   Faite    → ambre (réalisée, en attente de validation du coach)
//   Validée  → vert  (le coach a validé)
// Les autres états restent neutres : jamais de rouge qui culpabilise
// l'athlète pour une séance non faite (gris), sauf « pas de retour » (brique).
export type SessionTone = "todo" | "done" | "validated" | "noreport" | "missed" | "postponed" | "hors";

export const SESSION_TONES: Record<SessionTone, { label: string; fg: string; bg: string; bar: string }> = {
  todo: { label: "À faire", fg: "#1f5fa8", bg: "#e7f0fb", bar: "#3a7fd5" },
  done: { label: "Faite", fg: "#8a5300", bg: "#fdf0d8", bar: "#e39b1b" },
  validated: { label: "Validée", fg: "#17704a", bg: "#ddf3e7", bar: "#22a06b" },
  noreport: { label: "Pas de retour", fg: "#a4492a", bg: "#fbe3da", bar: "#c96f52" },
  missed: { label: "Non réalisée", fg: "#5b6660", bg: "#e9ecea", bar: "#9aa39c" },
  postponed: { label: "Reportée", fg: "#5b6660", bg: "#eceeed", bar: "#9aa39c" },
  hors: { label: "Hors programme", fg: "#5e4331", bg: "#f2ece6", bar: "#b9a18f" },
};

/** Ton d'une séance à partir de son statut en base. */
export function workoutTone(w: { status: string; date?: string; coach_validated_at?: string | null }, today?: string): SessionTone {
  if (w.status === "done" || w.status === "partial") return w.coach_validated_at ? "validated" : "done";
  if (w.status === "not_done") return "missed";
  if (w.status === "postponed") return "postponed";
  if (today && w.date && w.date < today) return "noreport";
  return "todo";
}
