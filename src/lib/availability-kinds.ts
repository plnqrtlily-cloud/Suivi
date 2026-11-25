// Motifs d'indisponibilité (fichier sans dépendance serveur, partagé par les
// formulaires et les affichages athlète et coach).
export interface UnavailabilityKind {
  value: string;
  label: string;
  /** Exemple pour la précision facultative. */
  placeholder: string;
  color: string;
  /** Proposé seulement aux athlètes concernées. */
  femaleOnly?: boolean;
}

export const UNAVAILABILITY_KINDS: UnavailabilityKind[] = [
  { value: "stage", label: "Stage", placeholder: "Lieu, club, fédération…", color: "#a4492a" },
  { value: "entrainement", label: "Entraînement", placeholder: "Club, autre sport…", color: "#3f6f6c" },
  { value: "sante", label: "Blessure ou maladie", placeholder: "Genou, grippe…", color: "#8a5a44" },
  { value: "regles", label: "Règles", placeholder: "", color: "#c2552f", femaleOnly: true },
  { value: "autre", label: "Autre", placeholder: "Travail, déplacement, examens…", color: "#5b6660" },
];

export function unavailabilityKind(value: string | null | undefined): UnavailabilityKind | null {
  return UNAVAILABILITY_KINDS.find((k) => k.value === value) ?? null;
}

/** « Stage · Font-Romeu », « Règles », ou la seule précision pour les anciennes entrées. */
export function unavailabilityReason(kind: string | null | undefined, reason: string | null | undefined): string | null {
  const k = unavailabilityKind(kind);
  const r = reason?.trim() || null;
  if (!k) return r;
  return r ? `${k.label} · ${r}` : k.label;
}
