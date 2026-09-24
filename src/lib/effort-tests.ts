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
    fields: [{ key: "distance_m", label: "Distance parcourue", unit: "m" }],
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
    fields: [{ key: "distance_m", label: "Distance parcourue", unit: "m" }],
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
