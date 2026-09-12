// Zones de fréquence cardiaque par méthode de Karvonen (réserve cardiaque =
// FC max − FC repos), modèle à 5 zones classique en endurance. Ne calcule
// qu'une zone "moyenne" par activité (à partir de la FC moyenne enregistrée),
// pas une distribution du temps passé dans chaque zone — les activités
// importées ne stockent qu'une FC moyenne, jamais un flux continu.
export interface HrZoneDef {
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
  minBpm: number;
  maxBpm: number;
}

const ZONE_DEFS = [
  { zone: 1 as const, label: "Récupération", minPct: 0.5, maxPct: 0.6 },
  { zone: 2 as const, label: "Endurance fondamentale", minPct: 0.6, maxPct: 0.7 },
  { zone: 3 as const, label: "Tempo", minPct: 0.7, maxPct: 0.8 },
  { zone: 4 as const, label: "Seuil", minPct: 0.8, maxPct: 0.9 },
  { zone: 5 as const, label: "VO2max", minPct: 0.9, maxPct: 1.0 },
];

export function computeHrZones(hrRest: number, hrMax: number): HrZoneDef[] {
  const hrr = hrMax - hrRest;
  return ZONE_DEFS.map((z) => ({
    zone: z.zone,
    label: z.label,
    minBpm: Math.round(hrRest + z.minPct * hrr),
    maxBpm: Math.round(hrRest + z.maxPct * hrr),
  }));
}

export function classifyHr(avgHr: number, hrRest: number, hrMax: number): HrZoneDef | null {
  if (!hrRest || !hrMax || hrMax <= hrRest) return null;
  const zones = computeHrZones(hrRest, hrMax);
  if (avgHr <= zones[0].minBpm) return zones[0];
  if (avgHr >= zones[zones.length - 1].maxBpm) return zones[zones.length - 1];
  return zones.find((z) => avgHr >= z.minBpm && avgHr <= z.maxBpm) || null;
}
