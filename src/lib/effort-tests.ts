// Tests à l'effort connus : chaque test définit les données brutes à
// prélever (ex. distance parcourue, temps) et la formule qui les traduit en
// un ou plusieurs indicateurs de performance déjà exploités ailleurs dans
// l'app (cf. src/lib/performance-metrics.ts) — une fois un test enregistré
// (src/lib/actions.ts, addEffortTestResultAction), l'indicateur résultant est
// répliqué dans athlete_measurements, donc les zones d'allure/puissance/FC
// (computePaceZones, computePowerZones, computeHrZones) et les statistiques
// du profil athlète se mettent à jour automatiquement, sans ressaisie
// manuelle d'une métrique déjà connue par ailleurs.

export interface EffortTestFieldDef {
  key: string;
  label: string;
  unit?: string;
  optional?: boolean;
  /** Quand renseigné, la valeur brute de ce champ est aussi enregistrée telle
   * quelle comme mesure de performance (athlete_measurements), en plus de
   * participer au calcul de compute() — pour les données déjà finales fournies
   * par le matériel du coach (ex. FC max, équilibre de pédalage) plutôt que des
   * données brutes à transformer par une formule. */
  metric?: string;
  /** Regroupement visuel des champs facultatifs (ex. "Équilibre de pédalage",
   * "Fréquence cardiaque") — les champs requis n'en ont pas besoin, ils
   * s'affichent toujours directement. Sert uniquement à structurer l'écran
   * de saisie (cf. effort-tests-panel.tsx), aucun effet sur le calcul. */
  group?: string;
}

export interface EffortTestResultDef {
  metric: string;
  label: string;
}

export interface EffortTestDef {
  slug: string;
  label: string;
  sport: string;
  description: string;
  fields: EffortTestFieldDef[];
  /** Calcule le ou les indicateurs résultants à partir des champs saisis. Une
   * ligne absente du retour (ex. champ facultatif manquant) n'est pas
   * enregistrée. */
  compute: (values: Record<string, number>) => { metric: string; value: number }[];
  results: EffortTestResultDef[];
}

export const EFFORT_TEST_CATALOG: Record<string, EffortTestDef> = {
  demi_cooper: {
    slug: "demi_cooper",
    label: "Demi-Cooper (6 min course à pied)",
    sport: "running",
    description: "Distance maximale parcourue en 6 minutes de course à intensité maximale soutenable.",
    fields: [
      { key: "distance_m", label: "Distance parcourue", unit: "m" },
      { key: "avg_hr", label: "FC moyenne pendant le test", unit: "bpm", optional: true, group: "Fréquence cardiaque" },
    ],
    results: [{ metric: "pma_vma", label: "PMA/VMA" }],
    compute: ({ distance_m }) => {
      if (!distance_m) return [];
      // Vitesse moyenne sur 360 s, convertie en km/h : (distance/1000) / (360/3600).
      const vma = Math.round(distance_m * 0.01 * 10) / 10;
      return [{ metric: "pma_vma", value: vma }];
    },
  },
  cooper_12min: {
    slug: "cooper_12min",
    label: "Test de Cooper (12 min course à pied)",
    sport: "running",
    description: "Distance maximale parcourue en 12 minutes de course à intensité maximale soutenable.",
    fields: [
      { key: "distance_m", label: "Distance parcourue", unit: "m" },
      { key: "avg_hr", label: "FC moyenne pendant le test", unit: "bpm", optional: true, group: "Fréquence cardiaque" },
    ],
    results: [{ metric: "vo2max", label: "VO2max estimée" }],
    compute: ({ distance_m }) => {
      if (!distance_m) return [];
      // Formule de Cooper (1968) : VO2max (ml/kg/min) = (distance − 504.9) / 44.73.
      const vo2max = Math.round(((distance_m - 504.9) / 44.73) * 10) / 10;
      return [{ metric: "vo2max", value: vo2max }];
    },
  },
  ftp_20min: {
    slug: "ftp_20min",
    label: "Test FTP (20 min vélo)",
    sport: "cycling",
    description: "Puissance moyenne maintenue sur 20 minutes à l'effort maximal soutenable.",
    fields: [
      { key: "avg_power_w", label: "Puissance moyenne sur 20 min", unit: "W" },
      { key: "weight_kg", label: "Poids du jour", unit: "kg", optional: true, metric: "weight_kg", group: "Général" },
      { key: "mmp_w", label: "Puissance Max Minute (MMP)", unit: "W", optional: true, metric: "mmp_w", group: "Puissance" },
      { key: "force_g_pct", label: "Équilibre de pédalage — Gauche", unit: "%", optional: true, metric: "pedal_force_g_pct", group: "Équilibre de pédalage" },
      { key: "force_d_pct", label: "Équilibre de pédalage — Droite", unit: "%", optional: true, metric: "pedal_force_d_pct", group: "Équilibre de pédalage" },
      { key: "angle_g_deg", label: "Angle de force max — Gauche", unit: "°", optional: true, metric: "pedal_angle_fmax_g_deg", group: "Équilibre de pédalage" },
      { key: "angle_d_deg", label: "Angle de force max — Droite", unit: "°", optional: true, metric: "pedal_angle_fmax_d_deg", group: "Équilibre de pédalage" },
      { key: "fc_max", label: "FC Max (MHR)", unit: "bpm", optional: true, metric: "fc_max", group: "Fréquence cardiaque" },
      { key: "fcs", label: "FCS (FC de seuil)", unit: "bpm", optional: true, metric: "fc_seuil", group: "Fréquence cardiaque" },
      { key: "vo2max_direct", label: "VO2max estimée", unit: "ml/kg/min", optional: true, metric: "vo2max", group: "Estimations" },
      { key: "met", label: "MET", unit: "MET", optional: true, metric: "met", group: "Estimations" },
    ],
    results: [
      { metric: "ftp", label: "FTP" },
      { metric: "power_weight_wkg", label: "Puissance / poids" },
    ],
    compute: ({ avg_power_w, weight_kg }) => {
      if (!avg_power_w) return [];
      // FTP ≈ 95 % de la puissance moyenne soutenue sur 20 minutes.
      const ftp = Math.round(avg_power_w * 0.95);
      const out = [{ metric: "ftp", value: ftp }];
      if (weight_kg) out.push({ metric: "power_weight_wkg", value: Math.round((ftp / weight_kg) * 100) / 100 });
      return out;
    },
  },
  ftp_ramp: {
    slug: "ftp_ramp",
    label: "Test FTP (rampe / paliers progressifs)",
    sport: "cycling",
    description:
      "Effort en paliers croissants jusqu'à l'échec : la meilleure puissance moyenne tenue sur 1 minute pendant le test.",
    fields: [
      { key: "best_1min_power_w", label: "Meilleure puissance moyenne sur 1 min", unit: "W" },
      { key: "weight_kg", label: "Poids du jour", unit: "kg", optional: true, group: "Général" },
    ],
    results: [
      { metric: "ftp", label: "FTP" },
      { metric: "power_weight_wkg", label: "Puissance / poids" },
    ],
    compute: ({ best_1min_power_w, weight_kg }) => {
      if (!best_1min_power_w) return [];
      // FTP ≈ 75 % de la meilleure puissance sur 1 min d'un test rampe.
      const ftp = Math.round(best_1min_power_w * 0.75);
      const out = [{ metric: "ftp", value: ftp }];
      if (weight_kg) out.push({ metric: "power_weight_wkg", value: Math.round((ftp / weight_kg) * 100) / 100 });
      return out;
    },
  },
  ftp_2x8min: {
    slug: "ftp_2x8min",
    label: "Test FTP (2 x 8 min vélo)",
    sport: "cycling",
    description: "Deux efforts maximaux de 8 minutes séparés d'une courte récupération.",
    fields: [
      { key: "power_8min_1_w", label: "Puissance moyenne — 1er effort de 8 min", unit: "W" },
      { key: "power_8min_2_w", label: "Puissance moyenne — 2e effort de 8 min", unit: "W" },
      { key: "weight_kg", label: "Poids du jour", unit: "kg", optional: true, group: "Général" },
    ],
    results: [
      { metric: "ftp", label: "FTP" },
      { metric: "power_weight_wkg", label: "Puissance / poids" },
    ],
    compute: ({ power_8min_1_w, power_8min_2_w, weight_kg }) => {
      if (!power_8min_1_w || !power_8min_2_w) return [];
      // FTP ≈ 90 % de la moyenne des deux efforts de 8 minutes.
      const avg = (power_8min_1_w + power_8min_2_w) / 2;
      const ftp = Math.round(avg * 0.9);
      const out = [{ metric: "ftp", value: ftp }];
      if (weight_kg) out.push({ metric: "power_weight_wkg", value: Math.round((ftp / weight_kg) * 100) / 100 });
      return out;
    },
  },
  puissance_30s: {
    slug: "puissance_30s",
    label: "Test de puissance 30 secondes (vélo)",
    sport: "cycling",
    description: "Sprint de 30 secondes à l'effort maximal soutenable, pour évaluer la puissance et la capacité anaérobie.",
    fields: [
      { key: "avg_power_w", label: "Puissance moyenne", unit: "W" },
      { key: "max_power_w", label: "Puissance max", unit: "W", optional: true, metric: "sprint_max_power_w", group: "Puissance" },
      { key: "weight_kg", label: "Poids du jour", unit: "kg", optional: true, metric: "weight_kg", group: "Général" },
      { key: "distance_m", label: "Distance parcourue", unit: "m", optional: true, metric: "test_distance_m", group: "Vitesse" },
      { key: "allure_moy", label: "Allure moyenne", unit: "min/km", optional: true, metric: "allure_moy_min_km", group: "Vitesse" },
      { key: "force_g_pct", label: "Équilibre de pédalage — Gauche", unit: "%", optional: true, metric: "pedal_force_g_pct", group: "Équilibre de pédalage" },
      { key: "force_d_pct", label: "Équilibre de pédalage — Droite", unit: "%", optional: true, metric: "pedal_force_d_pct", group: "Équilibre de pédalage" },
      { key: "angle_g_deg", label: "Angle de force max — Gauche", unit: "°", optional: true, metric: "pedal_angle_fmax_g_deg", group: "Équilibre de pédalage" },
      { key: "angle_d_deg", label: "Angle de force max — Droite", unit: "°", optional: true, metric: "pedal_angle_fmax_d_deg", group: "Équilibre de pédalage" },
      { key: "cadence_moy", label: "Cadence moyenne", unit: "t/min", optional: true, metric: "cadence_moy_tpm", group: "Cadence" },
      { key: "cadence_max", label: "Cadence max", unit: "t/min", optional: true, metric: "cadence_max_tpm", group: "Cadence" },
      { key: "coeff_fatigue", label: "Coefficient de fatigue", unit: "%", optional: true, metric: "coeff_fatigue_pct", group: "Fatigue" },
    ],
    results: [
      { metric: "sprint_avg_power_w", label: "Puissance moyenne (sprint 30 s)" },
      { metric: "power_weight_wkg", label: "Puissance / poids" },
    ],
    compute: ({ avg_power_w, weight_kg }) => {
      if (!avg_power_w) return [];
      const out = [{ metric: "sprint_avg_power_w", value: Math.round(avg_power_w) }];
      if (weight_kg) out.push({ metric: "power_weight_wkg", value: Math.round((avg_power_w / weight_kg) * 100) / 100 });
      return out;
    },
  },
  vma_1000m: {
    slug: "vma_1000m",
    label: "Test VMA (1000 m chronométré)",
    sport: "running",
    description: "Temps réalisé sur 1000 m à allure maximale soutenable, sur piste ou terrain plat.",
    fields: [{ key: "time_min", label: "Temps sur 1000 m", unit: "min" }],
    results: [{ metric: "pma_vma", label: "PMA/VMA" }],
    compute: ({ time_min }) => {
      if (!time_min) return [];
      // VMA (km/h) = 1 km parcouru en (temps en heures) = 60 / temps en minutes.
      const vma = Math.round((60 / time_min) * 10) / 10;
      return [{ metric: "pma_vma", value: vma }];
    },
  },
  navette_vameval: {
    slug: "navette_vameval",
    label: "Test navette (VAMEVAL / Luc Léger)",
    sport: "running",
    description: "Paliers d'une minute à vitesse croissante (+0,5 km/h), départ à 8 km/h, jusqu'à l'abandon.",
    fields: [{ key: "palier", label: "Dernier palier terminé", unit: "n°" }],
    results: [{ metric: "pma_vma", label: "PMA/VMA" }],
    compute: ({ palier }) => {
      if (!palier || palier < 1) return [];
      // Vitesse du dernier palier terminé : 8 km/h au palier 1, +0,5 km/h par palier.
      const vma = Math.round((8 + (palier - 1) * 0.5) * 10) / 10;
      return [{ metric: "pma_vma", value: vma }];
    },
  },
  seuil_30min: {
    slug: "seuil_30min",
    label: "Test seuil (30 min contre-la-montre, course à pied)",
    sport: "running",
    description:
      "Trente minutes à l'effort maximal soutenable. La FC moyenne des 20 dernières minutes approche la FC de seuil.",
    fields: [
      { key: "distance_m", label: "Distance parcourue en 30 min", unit: "m" },
      { key: "avg_hr_last_20min", label: "FC moyenne des 20 dernières minutes", unit: "bpm", optional: true, group: "Fréquence cardiaque" },
    ],
    results: [
      { metric: "allure_moy_min_km", label: "Allure de seuil" },
      { metric: "fc_seuil", label: "FC de seuil (FCS)" },
    ],
    compute: ({ distance_m, avg_hr_last_20min }) => {
      if (!distance_m) return [];
      // Allure (min/km) = 30 min / distance en km.
      const allure = Math.round((30 / (distance_m / 1000)) * 100) / 100;
      const out = [{ metric: "allure_moy_min_km", value: allure }];
      if (avg_hr_last_20min) out.push({ metric: "fc_seuil", value: Math.round(avg_hr_last_20min) });
      return out;
    },
  },
  vo2max_labo_velo: {
    slug: "vo2max_labo_velo",
    label: "VO2max en laboratoire · ergocycle",
    sport: "cycling",
    description: "Test triangulaire par paliers jusqu'à épuisement, avec analyse des gaz d'échange.",
    fields: [
      { key: "vo2max", label: "VO2max", unit: "ml/kg/min", metric: "vo2max" },
      { key: "pma_w", label: "PMA", unit: "W", metric: "pma_vma" },
      { key: "fc_max", label: "FC max", unit: "bpm", optional: true, metric: "fc_max", group: "Seuils" },
      { key: "sv1_w", label: "SV1 · puissance", unit: "W", optional: true, group: "Seuils" },
      { key: "sv1_bpm", label: "SV1 · FC", unit: "bpm", optional: true, group: "Seuils" },
      { key: "sv2_w", label: "SV2 · puissance", unit: "W", optional: true, metric: "seuil_lactique_w", group: "Seuils" },
      { key: "sv2_bpm", label: "SV2 · FC", unit: "bpm", optional: true, metric: "seuil_lactique_bpm", group: "Seuils" },
      { key: "lactate", label: "Lactate max", unit: "mmol/L", optional: true, metric: "lactate_mmol", group: "Laboratoire" },
      { key: "weight_kg", label: "Poids du jour", unit: "kg", optional: true, metric: "weight_kg", group: "Général" },
    ],
    results: [{ metric: "vo2max", label: "VO2max" }],
    compute: () => [],
  },
  vo2max_labo_tapis: {
    slug: "vo2max_labo_tapis",
    label: "VO2max en laboratoire · tapis",
    sport: "running",
    description: "Test par paliers de vitesse sur tapis jusqu'à épuisement, avec analyse des gaz d'échange.",
    fields: [
      { key: "vo2max", label: "VO2max", unit: "ml/kg/min", metric: "vo2max" },
      { key: "vma_kmh", label: "VMA", unit: "km/h", metric: "pma_vma" },
      { key: "fc_max", label: "FC max", unit: "bpm", optional: true, metric: "fc_max", group: "Seuils" },
      { key: "sv1_bpm", label: "SV1 · FC", unit: "bpm", optional: true, group: "Seuils" },
      { key: "sv2_bpm", label: "SV2 · FC", unit: "bpm", optional: true, metric: "seuil_lactique_bpm", group: "Seuils" },
      { key: "lactate", label: "Lactate max", unit: "mmol/L", optional: true, metric: "lactate_mmol", group: "Laboratoire" },
    ],
    results: [{ metric: "vo2max", label: "VO2max" }],
    compute: () => [],
  },
  css_natation: {
    slug: "css_natation",
    label: "Test CSS (400 m + 200 m chronométrés, natation)",
    sport: "swimming",
    description:
      "Deux nages chronométrées à allure maximale soutenable, 400 m puis 200 m (récupération courte entre les deux).",
    fields: [
      { key: "time_400_s", label: "Temps sur 400 m", unit: "s" },
      { key: "time_200_s", label: "Temps sur 200 m", unit: "s" },
    ],
    results: [{ metric: "allure_natation_min_100m", label: "Allure critique (CSS)" }],
    compute: ({ time_400_s, time_200_s }) => {
      if (!time_400_s || !time_200_s || time_400_s <= time_200_s) return [];
      // CSS (m/s) = (400 − 200) / (temps400 − temps200) — méthode des deux distances.
      const cssMs = 200 / (time_400_s - time_200_s);
      const paceMinPer100 = Math.round((100 / cssMs / 60) * 100) / 100;
      return [{ metric: "allure_natation_min_100m", value: paceMinPer100 }];
    },
  },
};

export const EFFORT_TEST_VALUES = Object.keys(EFFORT_TEST_CATALOG);

export function isKnownEffortTest(slug: string): boolean {
  return slug in EFFORT_TEST_CATALOG;
}

export interface CustomEffortTestFieldDef {
  key: string;
  label: string;
  unit?: string;
}

export function parseCustomFields(fieldsJson: string): CustomEffortTestFieldDef[] {
  try {
    const parsed = JSON.parse(fieldsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// --- Ergomètres ---
// Le coach choisit d'abord le support du test (ce qu'il a sous les yeux), puis
// le test parmi ceux qui s'y font. Stocké dans la colonne device du résultat.
export const ERGOMETERS: { value: string; label: string; tests: string[] }[] = [
  { value: "labo", label: "Laboratoire", tests: ["vo2max_labo_velo", "vo2max_labo_tapis"] },
  { value: "ergocycle", label: "Ergocycle · home trainer", tests: ["ftp_20min", "ftp_ramp", "ftp_2x8min", "puissance_30s", "vo2max_labo_velo"] },
  { value: "terrain", label: "Vélo sur route", tests: ["ftp_20min", "ftp_2x8min", "puissance_30s"] },
  { value: "tapis", label: "Tapis de course", tests: ["vo2max_labo_tapis", "vma_1000m", "seuil_30min"] },
  { value: "piste", label: "Piste · terrain", tests: ["vma_1000m", "demi_cooper", "cooper_12min", "navette_vameval", "seuil_30min"] },
  { value: "piscine", label: "Piscine", tests: ["css_natation"] },
  { value: "rameur", label: "Rameur", tests: [] },
  { value: "saut", label: "Plateforme de saut · force", tests: [] },
  { value: "autre", label: "Autre ergomètre", tests: [] },
];

export function ergometerLabel(value: string | null | undefined): string {
  return ERGOMETERS.find((e) => e.value === value)?.label ?? "";
}

/** Protocole proposé par défaut (modifiable à la saisie). */
export const DEFAULT_PROTOCOLS: Record<string, string> = {
  vo2max_labo_velo: "Échauffement 10 min à 100 W, puis paliers de +25 W toutes les minutes jusqu'à épuisement. Analyse des gaz d'échange en continu.",
  vo2max_labo_tapis: "Échauffement 10 min à 8 km/h, puis +1 km/h par minute à 1 % de pente jusqu'à épuisement.",
  ftp_20min: "Échauffement 20 min dont 3 × 1 min rapide, 5 min à allure seuil, 10 min de récupération, puis 20 min à l'effort maximal soutenable.",
  ftp_ramp: "Départ à 100 W, +20 W par minute jusqu'à l'échec.",
  ftp_2x8min: "Deux efforts maximaux de 8 min séparés de 10 min de récupération active.",
  puissance_30s: "30 s à fond, départ lancé, après un échauffement de 15 min.",
  vma_1000m: "1000 m chronométrés sur piste, départ arrêté, après 20 min d'échauffement.",
  demi_cooper: "Distance maximale parcourue en 6 min sur piste.",
  cooper_12min: "Distance maximale parcourue en 12 min sur piste.",
  navette_vameval: "Allers-retours de 20 m au rythme des bips, +0,5 km/h par palier d'une minute.",
  seuil_30min: "30 min au maximum soutenable ; FC moyenne sur les 20 dernières minutes.",
  css_natation: "400 m puis 200 m nage libre à fond, 10 min de récupération entre les deux.",
};

export interface TestExtra {
  label: string;
  value: string;
  unit?: string;
}

export function parseExtras(json: string | null | undefined): TestExtra[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => x && x.label && x.value !== undefined).map((x) => ({ label: String(x.label), value: String(x.value), unit: x.unit ? String(x.unit) : undefined })) : [];
  } catch {
    return [];
  }
}
