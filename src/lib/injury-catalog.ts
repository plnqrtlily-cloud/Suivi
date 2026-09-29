// Référentiel des blessures (onglet Santé) : zones, côtés, types et impact par sport.
export const BODY_PARTS = [
  "Nuque / cervicales",
  "Épaule",
  "Coude",
  "Poignet / main",
  "Dos · dorsales",
  "Dos · lombaires",
  "Abdominaux / côtes",
  "Hanche / bassin",
  "Adducteurs",
  "Ischio-jambiers",
  "Quadriceps",
  "Genou",
  "Mollet",
  "Tendon d’Achille",
  "Tibia",
  "Cheville",
  "Pied",
] as const;

export const SIDES = [
  { value: "", label: "—" },
  { value: "gauche", label: "Gauche" },
  { value: "droit", label: "Droit(e)" },
  { value: "deux", label: "Les deux" },
];

export const INJURY_TYPES = [
  "Tendinopathie",
  "Entorse",
  "Contracture / élongation",
  "Déchirure musculaire",
  "Fracture",
  "Luxation",
  "Contusion / chute",
  "Périostite",
  "Lombalgie",
  "Douleur non diagnostiquée",
  "Autre",
];

export type Impact = "ok" | "adapte" | "arret";
export const IMPACT_LABEL: Record<Impact, string> = { ok: "Normal", adapte: "Adapté", arret: "Arrêt" };
export const NEXT_IMPACT: Record<Impact, Impact> = { ok: "adapte", adapte: "arret", arret: "ok" };

// Zones au féminin (« droite ») quand le nom l'est.
const FEMININE = new Set(["Épaule", "Cheville", "Hanche / bassin"]);

/** Libellé lisible : « Genou gauche », « Cheville droite », « Dos · lombaires (des deux côtés) ». */
export function injuryLabel(bodyPart: string, side: string | null | undefined): string {
  if (!side) return bodyPart;
  if (side === "deux") return `${bodyPart} (des deux côtés)`;
  const base = bodyPart.split(" / ")[0];
  return `${base} ${side === "gauche" ? "gauche" : FEMININE.has(bodyPart) ? "droite" : "droit"}`;
}

export function parseImpact(json: string | null | undefined): Record<string, Impact> {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
