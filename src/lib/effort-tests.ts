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
      { key: "avg_hr", label: "FC moyenne pendant le test", unit: "bpm", optional: true },
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
      { key: "avg_hr", label: "FC moyenne pendant le test", unit: "bpm", optional: true },
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
      { key: "weight_kg", label: "Poids du jour", unit: "kg", optional: true },
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
      { key: "weight_kg", label: "Poids du jour", unit: "kg", optional: true },
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
      { key: "weight_kg", label: "Poids du jour", unit: "kg", optional: true },
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
      { key: "avg_hr_last_20min", label: "FC moyenne des 20 dernières minutes", unit: "bpm", optional: true },
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
