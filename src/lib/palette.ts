// Touches de couleur de Rythme : douces, désaturées, accordées au pétrole et
// au corail de la marque. Une teinte par sport (icônes, repères) et un ton
// pastel par personne (avatars sans photo). Fichier sans dépendance serveur.

export interface Tone {
  /** Couleur du trait / de l'icône. */
  color: string;
  /** Fond très léger assorti. */
  tint: string;
}

const SPORT_TONES: Record<string, Tone> = {
  running: { color: "#c8623f", tint: "#fbece5" },
  trail: { color: "#c8623f", tint: "#fbece5" },
  cycling: { color: "#2b78a8", tint: "#e7f1f8" },
  mtb: { color: "#2f7d5b", tint: "#e6f2ec" },
  hiking: { color: "#7d7330", tint: "#f2f0e0" },
  swimming: { color: "#1d8fa6", tint: "#e2f3f6" },
  strength: { color: "#6a4cc0", tint: "#efebf9" },
  climbing: { color: "#a8751c", tint: "#f8f0de" },
  other: { color: "#5b6660", tint: "#eceeed" },
};

/** Teinte d'un sport ; un vélo avec un type de VTT (enduro, DH…) prend le vert du VTT. */
export function sportTone(sport: string | null | undefined, discipline?: string | null): Tone {
  if (sport === "cycling" && discipline && discipline !== "route" && discipline !== "home_trainer") return SPORT_TONES.mtb;
  return SPORT_TONES[sport ?? ""] ?? SPORT_TONES.other;
}

const PERSON_TONES: Tone[] = [
  { color: "#1b5e52", tint: "#dcefe8" },
  { color: "#9a4426", tint: "#fbe4da" },
  { color: "#2b5f8a", tint: "#e1ecf8" },
  { color: "#5b45a0", tint: "#ebe6f8" },
  { color: "#7d6420", tint: "#f5ecd5" },
  { color: "#1d6c7c", tint: "#dff1f5" },
];

/** Ton pastel stable pour une personne (même couleur partout dans l'app). */
export function personTone(id: string): Tone {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PERSON_TONES[h % PERSON_TONES.length];
}
