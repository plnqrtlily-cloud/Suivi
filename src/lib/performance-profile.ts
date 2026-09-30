// Profil de performance (onglet Notes) : qualités par domaine, importance pour
// l'objectif × niveau actuel. La combinaison donne la zone : à travailler, à
// maintenir, à entretenir ou second plan (grille classique de préparation
// physique, et « performance profiling » de Butler & Hardy pour l'auto-évaluation).
export const PROFILE_DOMAINS = [
  { key: "phy", label: "Physique", color: "#1b4b4f" },
  { key: "psy", label: "Psychique", color: "#7a5aa6" },
  { key: "pmo", label: "Psychomoteur", color: "#2f7fb0" },
  { key: "tac", label: "Tactique", color: "#b07a1c" },
  { key: "nut", label: "Nutrition", color: "#6a8f3a" },
  { key: "hyg", label: "Hygiène de vie", color: "#5d8c8f" },
] as const;
export type ProfileDomain = (typeof PROFILE_DOMAINS)[number]["key"];

export const QUALITY_LIBRARY: Record<ProfileDomain, string[]> = {
  phy: ["Endurance aérobie", "PMA / VO2max", "Force maximale", "Explosivité", "Endurance de force", "Gainage / stabilité", "Mobilité", "Vitesse"],
  psy: ["Confiance en soi", "Gestion du stress en compétition", "Concentration", "Motivation / engagement", "Rebond après une erreur", "Visualisation", "Gestion des émotions"],
  pmo: ["Technique spécifique", "Coordination", "Équilibre", "Pilotage / trajectoires", "Passages techniques", "Proprioception"],
  tac: ["Gestion de l’effort", "Lecture de course", "Stratégie de course", "Reconnaissance du parcours", "Régularité"],
  nut: ["Apports énergétiques quotidiens", "Hydratation", "Nutrition à l’effort", "Récupération nutritionnelle", "Stratégie avant compétition", "Régularité des repas", "Micronutrition (fer, vitamine D)"],
  hyg: ["Sommeil", "Récupération", "Équilibre vie perso / sport", "Gestion de la charge extra-sportive", "Gestion des écrans le soir"],
};

/** Base proposée pour démarrer un profil vide : 3 qualités par domaine. */
export const QUALITY_BASE: [ProfileDomain, string][] = (Object.keys(QUALITY_LIBRARY) as ProfileDomain[]).flatMap((d) =>
  QUALITY_LIBRARY[d].slice(0, 3).map((n) => [d, n] as [ProfileDomain, string])
);

export const LEVEL_LABELS = ["À évaluer", "Très faible", "Faible", "Moyen", "Bon", "Excellent"];
export const IMPORTANCE_LABELS = ["", "Faible", "Moyenne", "Haute"];

export type QualityZone = "work" | "keep" | "ent" | "sec" | "todo";
export const ZONE_INFO: Record<QualityZone, { label: string; color: string; bg: string; text: string }> = {
  work: { label: "À travailler", color: "#a4492a", bg: "#fbeae3", text: "Compte pour l’objectif et n’est pas encore au niveau." },
  keep: { label: "À maintenir", color: "#1b4b4f", bg: "#e3eeee", text: "Qualité clé déjà solide : un rappel suffit." },
  ent: { label: "À entretenir", color: "#4f7f82", bg: "#eaf1f0", text: "Atout secondaire, entretenu par l’entraînement courant." },
  sec: { label: "Second plan", color: "#6b7571", bg: "#eef1f0", text: "Peu déterminant pour l’objectif : pas d’investissement maintenant." },
  todo: { label: "À évaluer", color: "#7a8480", bg: "#f2f4f3", text: "Pas encore notée : donnez-lui un niveau." },
};

export function qualityZone(level: number, importance: number): QualityZone {
  if (!level) return "todo";
  if (importance >= 2) return level >= 4 ? "keep" : "work";
  return level >= 4 ? "ent" : "sec";
}
