// Indicateurs de performance mesurables, partagés entre le profil athlète et
// la fiche coach — une seule source de vérité plutôt qu'une liste redéfinie
// dans chaque page. Regroupés par thème (le champ "group") : à plus d'une
// vingtaine d'indicateurs toutes disciplines confondues, un menu déroulant à
// plat devient difficile à parcourir — les <optgroup> du formulaire d'ajout
// s'appuient dessus.
export const METRIC_GROUPS = ["Général", "Composition corporelle", "Mensurations", "Cardio", "Vélo", "Course à pied", "Natation", "Test en laboratoire"] as const;
export type MetricGroup = (typeof METRIC_GROUPS)[number];

export interface MetricDef {
  value: string;
  label: string;
  unit?: string;
  group: MetricGroup;
}

export const PERFORMANCE_METRICS: MetricDef[] = [
  { value: "weight_kg", label: "Poids", unit: "kg", group: "Général" },
  { value: "height_cm", label: "Taille", unit: "cm", group: "Général" },
  { value: "pma_vma", label: "PMA/VMA", group: "Général" },
  { value: "coeff_fatigue_pct", label: "Coefficient de fatigue", unit: "%", group: "Général" },

  { value: "body_fat_pct", label: "Masse grasse", unit: "%", group: "Composition corporelle" },
  { value: "muscle_mass_kg", label: "Masse musculaire", unit: "kg", group: "Composition corporelle" },
  { value: "skinfolds_mm", label: "Somme des plis cutanés", unit: "mm", group: "Composition corporelle" },
  { value: "hydration_pct", label: "Hydratation", unit: "%", group: "Composition corporelle" },

  { value: "arm_span_cm", label: "Envergure", unit: "cm", group: "Mensurations" },
  { value: "waist_cm", label: "Tour de taille", unit: "cm", group: "Mensurations" },
  { value: "hips_cm", label: "Tour de hanches", unit: "cm", group: "Mensurations" },
  { value: "chest_cm", label: "Tour de poitrine", unit: "cm", group: "Mensurations" },
  { value: "arm_cm", label: "Tour de bras", unit: "cm", group: "Mensurations" },
  { value: "thigh_cm", label: "Tour de cuisse", unit: "cm", group: "Mensurations" },
  { value: "calf_cm", label: "Tour de mollet", unit: "cm", group: "Mensurations" },

  { value: "fc_repos", label: "FC repos", unit: "bpm", group: "Cardio" },
  { value: "hrv_ms", label: "VFC (rMSSD)", unit: "ms", group: "Cardio" },
  { value: "fc_max", label: "FC max (MHR)", unit: "bpm", group: "Cardio" },
  { value: "fc_seuil", label: "FC de seuil (FCS)", unit: "bpm", group: "Cardio" },
  // Seuil lactique : intensité au-delà de laquelle le lactate s'accumule plus
  // vite qu'il n'est éliminé — repère central en endurance, distinct du FTP.
  { value: "seuil_lactique_bpm", label: "Seuil lactique (FC)", unit: "bpm", group: "Cardio" },
  { value: "seuil_lactique_w", label: "Seuil lactique (puissance)", unit: "W", group: "Cardio" },
  { value: "lactate_mmol", label: "Lactatémie mesurée", unit: "mmol/L", group: "Cardio" },

  { value: "ftp", label: "FTP", unit: "W", group: "Vélo" },
  { value: "mmp_w", label: "Puissance max minute (MMP)", unit: "W", group: "Vélo" },
  { value: "power_weight_wkg", label: "Puissance / poids", unit: "W/kg", group: "Vélo" },
  // Équilibre de pédalage (capteur de puissance vélo) : répartition gauche/droite
  // de la force et de l'angle où elle est maximale — chaque côté se renseigne
  // séparément, une asymétrie n'a de sens que comparée à son autre moitié.
  { value: "pedal_force_g_pct", label: "Équilibre de pédalage — Gauche", unit: "%", group: "Vélo" },
  { value: "pedal_force_d_pct", label: "Équilibre de pédalage — Droite", unit: "%", group: "Vélo" },
  { value: "pedal_angle_fmax_g_deg", label: "Angle de force max — Gauche", unit: "°", group: "Vélo" },
  { value: "pedal_angle_fmax_d_deg", label: "Angle de force max — Droite", unit: "°", group: "Vélo" },
  // Sprint 30 s : capacité anaérobie, distincte du MMP (1 min) et du FTP (seuil).
  { value: "sprint_avg_power_w", label: "Puissance moyenne — sprint 30 s", unit: "W", group: "Vélo" },
  { value: "sprint_max_power_w", label: "Puissance max — sprint 30 s", unit: "W", group: "Vélo" },

  { value: "allure_moy_min_km", label: "Allure moyenne", unit: "min/km", group: "Course à pied" },
  { value: "cadence_moy_tpm", label: "Cadence moyenne", unit: "t/min", group: "Course à pied" },
  { value: "cadence_max_tpm", label: "Cadence max", unit: "t/min", group: "Course à pied" },
  // Test de puissance course à pied (ex. capteur de puissance foulée) : les
  // mêmes indicateurs qu'un test vélo, mais mesurés au sol.
  { value: "avg_power_test_w", label: "Puissance moyenne (test)", unit: "W", group: "Course à pied" },
  { value: "max_power_test_w", label: "Puissance max (test)", unit: "W", group: "Course à pied" },
  { value: "test_distance_m", label: "Distance du test", unit: "m", group: "Course à pied" },
  { value: "run_force_g_deg", label: "Force — Gauche", unit: "°", group: "Course à pied" },
  { value: "run_force_d_deg", label: "Force — Droite", unit: "°", group: "Course à pied" },
  { value: "run_angle_g_deg", label: "Angle — Gauche", unit: "°", group: "Course à pied" },
  { value: "run_angle_d_deg", label: "Angle — Droite", unit: "°", group: "Course à pied" },

  // CSS (Critical Swim Speed) : allure de référence en natation, l'équivalent
  // du FTP vélo ou du seuil course à pied — issue d'un test 400 m + 200 m.
  { value: "allure_natation_min_100m", label: "Allure critique (CSS)", unit: "min/100m", group: "Natation" },

  { value: "vo2max", label: "VO2max estimée", unit: "ml/kg/min", group: "Test en laboratoire" },
  { value: "met", label: "MET", unit: "MET", group: "Test en laboratoire" },
  { value: "test_duration_min", label: "Durée du test", unit: "min", group: "Test en laboratoire" },
];

export const METRIC_LABELS: Record<string, string> = Object.fromEntries(
  PERFORMANCE_METRICS.map((m) => [m.value, m.unit ? `${m.label} (${m.unit})` : m.label])
);

/** Regroupe une liste d'indicateurs par thème, dans l'ordre de METRIC_GROUPS, pour peupler des <optgroup>. */
export function groupMetrics<T extends { group?: string }>(metrics: T[]): { group: string; items: T[] }[] {
  return METRIC_GROUPS.map((group) => ({ group, items: metrics.filter((m) => m.group === group) })).filter(
    (g) => g.items.length > 0
  );
}

// Appareil sur lequel la mesure a été réalisée. Un FTP sur ergocycle n'est pas
// comparable à un FTP sur route (position, inertie, rendement) — les
// différencier évite de comparer des valeurs qui ne le sont pas.
export const MEASUREMENT_DEVICES: { value: string; label: string }[] = [
  { value: "", label: "Non précisé" },
  { value: "terrain", label: "Terrain / extérieur" },
  { value: "ergocycle", label: "Ergocycle / home-trainer" },
  { value: "tapis", label: "Tapis de course" },
  { value: "rameur", label: "Rameur" },
  { value: "piste", label: "Piste" },
  { value: "piscine", label: "Piscine" },
  { value: "labo", label: "Laboratoire / test médical" },
];

export function deviceLabel(device: string | null): string {
  if (!device) return "";
  return MEASUREMENT_DEVICES.find((d) => d.value === device)?.label || device;
}

// --- Indicateurs dérivés, calculés à partir de mesures de la MÊME date ---

export interface DerivedMetric {
  label: string;
  value: string;
  explanation: string;
}

/**
 * Calcule les indicateurs déductibles des mesures saisies un même jour.
 * Ne devine rien : chaque indicateur n'apparaît que si toutes ses données
 * sources existent à cette date, pour ne pas mélanger un poids de janvier avec
 * une FC max de juin.
 */
export function computeDerivedMetrics(valuesOnDate: Record<string, number>): DerivedMetric[] {
  const derived: DerivedMetric[] = [];
  const { fc_repos, fc_max, ftp, weight_kg, height_cm, seuil_lactique_bpm } = valuesOnDate;

  // FC de réserve (Karvonen) : marge entre repos et max, base du calcul des
  // zones cardiaques par pourcentage d'effort.
  if (fc_repos && fc_max) {
    derived.push({
      label: "FC de réserve",
      value: `${fc_max - fc_repos} bpm`,
      explanation: "FC max − FC repos (méthode de Karvonen), base du calcul des zones cardiaques.",
    });
  }

  // Rapport poids/puissance : indicateur clé en cyclisme, surtout en montée.
  if (ftp && weight_kg) {
    derived.push({
      label: "Rapport poids/puissance",
      value: `${(ftp / weight_kg).toFixed(2)} W/kg`,
      explanation: "FTP ÷ poids — référence en cyclisme, notamment sur terrain vallonné.",
    });
  }

  // IMC : contexte général, à interpréter avec prudence chez les sportifs
  // (la masse musculaire fausse la lecture).
  if (weight_kg && height_cm) {
    const imc = weight_kg / Math.pow(height_cm / 100, 2);
    derived.push({
      label: "IMC",
      value: imc.toFixed(1),
      explanation: "Indicateur général — peu pertinent chez les sportifs très musclés, à lire avec recul.",
    });
  }

  // Part du seuil lactique dans la FC max : situe le seuil sur l'échelle
  // d'intensité de l'athlète.
  if (seuil_lactique_bpm && fc_max) {
    derived.push({
      label: "Seuil lactique / FC max",
      value: `${Math.round((seuil_lactique_bpm / fc_max) * 100)} %`,
      explanation: "Position du seuil lactique dans l'échelle d'intensité — plus il est haut, plus l'athlète tient longtemps à intensité élevée.",
    });
  }

  return derived;
}

// --- Mesures corporelles (carte « Mesures corporelles » de la fiche) ---

/** Mesures proposées dans la liste « + Mesure », les essentielles en tête. */
export const BODY_METRICS: { key: string; label: string; unit: string; group: string; hint?: string }[] = [
  { key: "weight_kg", label: "Poids", unit: "kg", group: "Essentielles" },
  { key: "height_cm", label: "Taille", unit: "cm", group: "Essentielles" },
  { key: "fc_repos", label: "FC de repos", unit: "bpm", group: "Essentielles", hint: "Au réveil, allongé, avant de se lever" },
  { key: "hrv_ms", label: "VFC (rMSSD)", unit: "ms", group: "Essentielles", hint: "Variabilité de la fréquence cardiaque, le matin" },
  { key: "body_fat_pct", label: "Masse grasse", unit: "%", group: "Composition" },
  { key: "muscle_mass_kg", label: "Masse musculaire", unit: "kg", group: "Composition" },
  { key: "skinfolds_mm", label: "Somme des plis cutanés", unit: "mm", group: "Composition", hint: "7 sites (pince Harpenden)" },
  { key: "hydration_pct", label: "Hydratation", unit: "%", group: "Composition" },
  { key: "arm_span_cm", label: "Envergure", unit: "cm", group: "Mensurations" },
  { key: "waist_cm", label: "Tour de taille", unit: "cm", group: "Mensurations", hint: "Au niveau du nombril, en fin d’expiration" },
  { key: "hips_cm", label: "Tour de hanches", unit: "cm", group: "Mensurations" },
  { key: "chest_cm", label: "Tour de poitrine", unit: "cm", group: "Mensurations" },
  { key: "arm_cm", label: "Tour de bras", unit: "cm", group: "Mensurations", hint: "Bras détendu, à mi-hauteur" },
  { key: "thigh_cm", label: "Tour de cuisse", unit: "cm", group: "Mensurations", hint: "15 cm au-dessus de la rotule" },
  { key: "calf_cm", label: "Tour de mollet", unit: "cm", group: "Mensurations" },
];

/** Nom normalisé (minuscules, sans accents) : deux saisies « Gainage » et « gainage » désignent la même mesure. */
export function normalizeMetricName(name: string): string {
  return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

/** Clé d'une mesure nommée par le coach. */
export function customMetricKey(name: string): string {
  return "custom:" + normalizeMetricName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
