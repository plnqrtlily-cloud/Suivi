// Zones de puissance (vélo) à partir du FTP — modèle inspiré de Coggan,
// condensé à 5 zones pour rester cohérent avec le modèle FC à 5 zones déjà
// utilisé dans l'app (src/lib/hr-zones.ts).
export interface PowerZoneDef {
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
  minW: number;
  maxW: number;
}

const ZONE_DEFS = [
  { zone: 1 as const, label: "Récupération active", minPct: 0, maxPct: 0.55 },
  { zone: 2 as const, label: "Endurance", minPct: 0.55, maxPct: 0.75 },
  { zone: 3 as const, label: "Tempo", minPct: 0.75, maxPct: 0.9 },
  { zone: 4 as const, label: "Seuil", minPct: 0.9, maxPct: 1.05 },
  { zone: 5 as const, label: "VO2max et au-delà", minPct: 1.05, maxPct: 1.5 },
];

export function computePowerZones(ftpWatts: number): PowerZoneDef[] {
  return ZONE_DEFS.map((z) => ({
    zone: z.zone,
    label: z.label,
    minW: Math.round(ftpWatts * z.minPct),
    maxW: Math.round(ftpWatts * z.maxPct),
  }));
}
