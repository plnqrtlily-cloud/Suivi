// Zones d'allure (course à pied) à partir de la VMA — le champ mesure
// "pma_vma" sert à la fois de PMA (vélo, en watts) et de VMA (course, en
// km/h) selon le sport de l'athlète ; ces zones interprètent sa valeur comme
// une vitesse en km/h, pertinentes uniquement pour un athlète coureur.
export interface PaceZoneDef {
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
  minPaceMinPerKm: number; // allure la plus rapide de la zone (valeur la plus basse)
  maxPaceMinPerKm: number; // allure la plus lente de la zone
}

const ZONE_DEFS = [
  { zone: 1 as const, label: "Récupération", minPct: 0.5, maxPct: 0.6 },
  { zone: 2 as const, label: "Endurance fondamentale", minPct: 0.6, maxPct: 0.75 },
  { zone: 3 as const, label: "Tempo / Seuil", minPct: 0.75, maxPct: 0.9 },
  { zone: 4 as const, label: "VMA courte", minPct: 0.9, maxPct: 1.0 },
  { zone: 5 as const, label: "Sprint / Survitesse", minPct: 1.0, maxPct: 1.2 },
];

export function computePaceZones(vmaKmh: number): PaceZoneDef[] {
  return ZONE_DEFS.map((z) => ({
    zone: z.zone,
    label: z.label,
    minPaceMinPerKm: 60 / (vmaKmh * z.maxPct),
    maxPaceMinPerKm: 60 / (vmaKmh * z.minPct),
  }));
}

export function formatPace(minPerKm: number): string {
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}
