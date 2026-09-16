// Indicateurs de performance mesurables, partagés entre le profil athlète et
// la fiche coach — une seule source de vérité plutôt qu'une liste redéfinie
// dans chaque page.
export interface MetricDef {
  value: string;
  label: string;
  unit?: string;
}

export const PERFORMANCE_METRICS: MetricDef[] = [
  { value: "weight_kg", label: "Poids", unit: "kg" },
  { value: "height_cm", label: "Taille", unit: "cm" },
  { value: "fc_repos", label: "FC repos", unit: "bpm" },
  { value: "fc_max", label: "FC max", unit: "bpm" },
  { value: "vo2max", label: "VO2max", unit: "ml/kg/min" },
  { value: "ftp", label: "FTP", unit: "W" },
  { value: "pma_vma", label: "PMA/VMA" },
  // Seuil lactique : intensité au-delà de laquelle le lactate s'accumule plus
  // vite qu'il n'est éliminé — repère central en endurance, distinct du FTP.
  { value: "seuil_lactique_bpm", label: "Seuil lactique (FC)", unit: "bpm" },
  { value: "seuil_lactique_w", label: "Seuil lactique (puissance)", unit: "W" },
  { value: "lactate_mmol", label: "Lactatémie mesurée", unit: "mmol/L" },
];

export const METRIC_LABELS: Record<string, string> = Object.fromEntries(
  PERFORMANCE_METRICS.map((m) => [m.value, m.unit ? `${m.label} (${m.unit})` : m.label])
);

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
