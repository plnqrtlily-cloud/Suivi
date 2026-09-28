// Activités proposées dans l'éditeur de séance. Le champ `sport` de la base
// reste volontairement large (running, cycling…) ; la variante (VTT, trail,
// home trainer…) et les objectifs chiffrés propres à chaque discipline vivent
// dans workouts.plan_json. Fichier sans dépendance serveur.

export type PlanKey = "dist" | "dplus" | "allure" | "puiss" | "cad" | "distm" | "bassin" | "voies" | "cot";
export type TargetKind = "hr_zone" | "pace_zone" | "power_zone" | "free" | "none";
export type UnitKind = "min" | "km" | "m" | "libre";

export interface ActivityDef {
  id: string;
  label: string;
  sport: string;
  /** Champs d'objectif affichés en plus de la durée et du RPE visé. */
  plan: PlanKey[];
  /** Cibles d'intensité proposées pour une étape, la première servant de défaut. */
  targets: TargetKind[];
  /** Unités proposées pour la durée d'une étape. */
  units: UnitKind[];
  /** Minutes par unité de distance, pour estimer la durée d'une étape en distance. */
  minPerKm: number;
  titlePh: string;
  notesPh: string;
  freePh: string;
  swim?: boolean;
}

export const ACTIVITIES: ActivityDef[] = [
  { id: "running", label: "Course à pied", sport: "running", plan: ["dist", "allure"], targets: ["pace_zone", "hr_zone", "free", "none"], units: ["min", "km", "libre"], minPerKm: 5.5, titlePh: "ex. Fractionné 6 × 1 000 m", notesPh: "Terrain, chaussures, points techniques…", freePh: "ex. 4'30/km" },
  { id: "trail", label: "Trail", sport: "running", plan: ["dist", "dplus"], targets: ["hr_zone", "pace_zone", "free", "none"], units: ["min", "km", "libre"], minPerKm: 8, titlePh: "ex. Sortie longue en montagne", notesPh: "Parcours, bâtons, ravitaillement…", freePh: "ex. marche en côte" },
  { id: "road", label: "Vélo route", sport: "cycling", plan: ["dist", "puiss"], targets: ["power_zone", "hr_zone", "free", "none"], units: ["min", "km", "libre"], minPerKm: 2.2, titlePh: "ex. Sweet spot 3 × 10 min", notesPh: "Parcours, ravitaillement, cadence…", freePh: "ex. cadence 90" },
  { id: "mtb", label: "VTT", sport: "cycling", plan: ["dist", "dplus"], targets: ["hr_zone", "power_zone", "free", "none"], units: ["min", "km", "libre"], minPerKm: 3, titlePh: "ex. Endurance + changements de rythme", notesPh: "Parcours, technique, pression des pneus…", freePh: "ex. assis, grand braquet" },
  { id: "trainer", label: "Home trainer", sport: "cycling", plan: ["puiss", "cad"], targets: ["power_zone", "hr_zone", "free", "none"], units: ["min", "libre"], minPerKm: 2, titlePh: "ex. Force-endurance", notesPh: "Cadence, ventilation, hydratation…", freePh: "ex. 50-60 rpm" },
  { id: "swimming", label: "Natation", sport: "swimming", plan: ["distm", "bassin"], targets: ["pace_zone", "free", "none"], units: ["m", "min", "libre"], minPerKm: 20, titlePh: "ex. Technique + 8 × 100 m", notesPh: "Matériel (plaquettes, pull-buoy), éducatifs…", freePh: "ex. départ toutes les 1'50", swim: true },
  { id: "hiking", label: "Randonnée", sport: "hiking", plan: ["dist", "dplus"], targets: ["hr_zone", "free", "none"], units: ["min", "km", "libre"], minPerKm: 12, titlePh: "ex. Rando longue avec dénivelé", notesPh: "Itinéraire, sac, ravitaillement…", freePh: "ex. rythme régulier" },
  { id: "climbing", label: "Escalade", sport: "climbing", plan: ["voies", "cot"], targets: ["free", "none"], units: ["min", "libre"], minPerKm: 1, titlePh: "ex. Continuité en voie", notesPh: "Style (bloc, voie), prises à travailler, sécurité…", freePh: "ex. 5 voies en 6b, 3 min entre" },
  { id: "strength", label: "Musculation", sport: "strength", plan: [], targets: ["free", "none"], units: ["min", "libre"], minPerKm: 1, titlePh: "ex. Renforcement bas du corps", notesPh: "Tempo, amplitude, sécurité…", freePh: "" },
  { id: "mobility", label: "Mobilité", sport: "other", plan: [], targets: ["free", "none"], units: ["min", "libre"], minPerKm: 1, titlePh: "ex. Mobilité et gainage", notesPh: "Zones à travailler, respiration…", freePh: "ex. hanches, chaîne postérieure" },
  { id: "other", label: "Autre", sport: "other", plan: ["dist"], targets: ["hr_zone", "free", "none"], units: ["min", "km", "libre"], minPerKm: 6, titlePh: "ex. Séance libre", notesPh: "Consignes…", freePh: "" },
];

export const PLAN_FIELDS: Record<PlanKey, { label: string; unit: string; ph: string; numeric: boolean }> = {
  dist: { label: "Distance prévue", unit: "km", ph: "12", numeric: true },
  dplus: { label: "Dénivelé + prévu", unit: "m", ph: "600", numeric: true },
  allure: { label: "Allure cible", unit: "min/km", ph: "4'45", numeric: false },
  puiss: { label: "Puissance cible", unit: "W", ph: "220", numeric: true },
  cad: { label: "Cadence cible", unit: "rpm", ph: "90", numeric: true },
  distm: { label: "Distance prévue", unit: "m", ph: "2 500", numeric: true },
  bassin: { label: "Bassin", unit: "", ph: "25 m", numeric: false },
  voies: { label: "Voies / blocs", unit: "", ph: "12", numeric: true },
  cot: { label: "Cotation visée", unit: "", ph: "6b", numeric: false },
};

export interface PlanData {
  activity?: string;
  values?: Partial<Record<PlanKey, string>>;
}

export function activityById(id: string | null | undefined): ActivityDef {
  return ACTIVITIES.find((a) => a.id === id) ?? ACTIVITIES[0];
}

/** Activité par défaut pour un sport en base (séances créées avant les variantes). */
export function activityForSport(sport: string, plan?: PlanData | null): ActivityDef {
  if (plan?.activity) {
    const a = ACTIVITIES.find((x) => x.id === plan.activity && x.sport === sport);
    if (a) return a;
  }
  const map: Record<string, string> = { running: "running", cycling: "road", swimming: "swimming", hiking: "hiking", climbing: "climbing", strength: "strength", other: "other" };
  return activityById(map[sport] ?? "other");
}

export function parsePlan(json: string | null | undefined): PlanData | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as PlanData) : null;
  } catch {
    return null;
  }
}

/** Objectifs renseignés, en libellés lisibles (« Distance prévue : 12 km »). */
export function planSummary(plan: PlanData | null): { label: string; value: string }[] {
  if (!plan?.values) return [];
  return (Object.keys(plan.values) as PlanKey[])
    .filter((k) => PLAN_FIELDS[k] && plan.values?.[k])
    .map((k) => {
      const f = PLAN_FIELDS[k];
      return { label: f.label, value: `${plan.values![k]}${f.unit ? ` ${f.unit}` : ""}` };
    });
}
