// Plages des zones de l'athlète, déjà formatées pour l'éditeur de séance
// (« 146-160 bpm », « 220-260 W », « 4:25-4:50 /km »), à partir de ses
// dernières mesures. Une zone manquante (pas de FC max, pas de FTP…) n'affiche
// simplement pas de plage à côté du numéro de zone.
import { computeHrZones } from "./hr-zones";
import { computePowerZones } from "./power-zones";
import { computePaceZones } from "./pace-zones";

function pace(v: number): string {
  const min = Math.floor(v);
  const sec = Math.round((v - min) * 60);
  return sec === 60 ? `${min + 1}:00` : `${min}:${String(sec).padStart(2, "0")}`;
}

export function zoneLabelsFor(latest: Record<string, { value: number }>) {
  const out: { hr_zone?: string[]; power_zone?: string[]; pace_zone?: string[] } = {};
  if (latest.fc_repos && latest.fc_max && latest.fc_max.value > latest.fc_repos.value) {
    out.hr_zone = computeHrZones(latest.fc_repos.value, latest.fc_max.value).map((z) => `${z.minBpm}-${z.maxBpm} bpm`);
  }
  if (latest.ftp) out.power_zone = computePowerZones(latest.ftp.value).map((z, i, a) => (i === a.length - 1 ? `> ${z.minW} W` : `${z.minW}-${z.maxW} W`));
  if (latest.pma_vma) out.pace_zone = computePaceZones(latest.pma_vma.value).map((z) => `${pace(z.minPaceMinPerKm)}-${pace(z.maxPaceMinPerKm)} /km`);
  return out;
}
