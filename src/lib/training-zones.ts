// Tableau unique des zones d'entraînement (FC, puissance, allure) exprimées
// par 4 bornes par discipline : Z1 < b1 ≤ Z2 < b2 ≤ Z3 < b3 ≤ Z4 < b4 ≤ Z5.
// Les allures sont stockées en vitesse (km/h) pour que les bornes restent
// croissantes comme les autres ; elles sont converties en min/km à l'affichage.
//
// Priorité de calcul : seuils ventilatoires d'un test (SV1/SV2) > méthode
// classique (Karvonen, FTP, VMA) ; le coach peut ensuite ajuster chaque borne
// à la main (athlete_zone_overrides), la valeur manuelle l'emportant.

export type Cuts = [number, number, number, number];
export type ZoneKind = "hr" | "pw" | "pace";

export const ZONE_NAMES = ["Récupération", "Endurance", "Tempo", "Seuil", "PMA"] as const;
export const ZONE_FEEL = [
  "Très facile · RPE 1-2",
  "Conversation possible · RPE 3-4",
  "Soutenu, phrases courtes · RPE 5-6",
  "Dur, quelques mots · RPE 7-8",
  "Très dur, pas de parole · RPE 9-10",
];

export interface ZoneInputs {
  fcRepos?: number;
  fcMax?: number;
  ftp?: number;
  pma?: number;
  vma?: number;
  /** Seuils du dernier test de laboratoire, s'il y en a un. */
  sv?: { sv1w?: number; sv2w?: number; sv1hr?: number; sv2hr?: number; date: string; label: string };
}

export interface ZoneSet {
  hr: Cuts | null;
  pw: Cuts | null;
  pace: Cuts | null;
}

const r = Math.round;
const r1 = (v: number) => Math.round(v * 10) / 10;

export function autoZones(i: ZoneInputs): ZoneSet & { source: string } {
  let hr: Cuts | null = null;
  let pw: Cuts | null = null;
  let pace: Cuts | null = null;
  const src: string[] = [];
  const sv = i.sv;

  if (sv?.sv1hr && sv?.sv2hr) {
    hr = [r(sv.sv1hr * 0.92), sv.sv1hr + 4, sv.sv2hr - 10, sv.sv2hr + 2];
  } else if (sv?.sv2hr) {
    const l = sv.sv2hr;
    hr = [r(l * 0.81), r(l * 0.89) + 1, r(l * 0.93) + 1, r(l * 0.99) + 1];
  } else if (i.fcRepos && i.fcMax && i.fcMax > i.fcRepos) {
    const hrr = i.fcMax - i.fcRepos;
    hr = [0.6, 0.7, 0.8, 0.9].map((p) => r(i.fcRepos! + p * hrr)) as Cuts;
    src.push(`FC repos ${i.fcRepos} et FC max ${i.fcMax}`);
  } else if (i.fcMax) {
    hr = [0.68, 0.8, 0.88, 0.94].map((p) => r(i.fcMax! * p)) as Cuts;
    src.push(`FC max ${i.fcMax}`);
  }

  if (sv?.sv1w && sv?.sv2w) {
    pw = [r(sv.sv1w * 0.785), sv.sv1w + 13, r(sv.sv2w * 0.853), sv.sv2w + 2];
  } else if (i.ftp) {
    pw = [0.55, 0.75, 0.9, 1.05].map((p) => r(i.ftp! * p)) as Cuts;
    src.push(`FTP ${i.ftp} W`);
  } else if (i.pma) {
    const ftp = i.pma * 0.75;
    pw = [0.55, 0.75, 0.9, 1.05].map((p) => r(ftp * p)) as Cuts;
    src.push(`PMA ${i.pma} W`);
  }

  if (i.vma) {
    pace = [0.6, 0.75, 0.85, 0.95].map((p) => r1(i.vma! * p)) as Cuts;
    src.push(`VMA ${String(i.vma).replace(".", ",")} km/h`);
  }

  const usedSv = !!(sv && ((sv.sv1hr && sv.sv2hr) || sv.sv2hr || (sv.sv1w && sv.sv2w)));
  const source = usedSv
    ? `Calculées à partir du test du ${frDay(sv!.date)} (seuils SV1 et SV2)${src.length ? ` et de ${src.join(", ")}` : ""}`
    : src.length
      ? `Calculées à partir de ${src.join(", ")}`
      : "";
  return { hr, pw, pace, source };
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function frDay(iso: string) {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]}`;
}

export function parseCuts(json: string | null | undefined): Cuts | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === "number" && x > 0) ? (v as Cuts) : null;
  } catch {
    return null;
  }
}

/** Zone (0-4) d'une valeur selon les bornes. */
export function zoneOf(value: number, cuts: Cuts): number {
  let z = 0;
  while (z < 4 && value >= cuts[z]) z++;
  return z;
}

export function paceOf(kmh: number): string {
  const minPerKm = 60 / kmh;
  let m = Math.floor(minPerKm);
  let s = Math.round((minPerKm - m) * 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}'${String(s).padStart(2, "0")}`;
}

/** « 4'25 », « 4:25 » ou « 4.5 » (min/km) → vitesse en km/h. */
export function kmhFromPace(txt: string): number | null {
  const t = txt.trim().replace(/[’′]/g, "'");
  const m = t.match(/^(\d{1,2})\s*['":h]\s*(\d{1,2})$/);
  const min = m ? Number(m[1]) + Number(m[2]) / 60 : Number(t.replace(",", "."));
  if (!(min > 1.5 && min < 20)) return null;
  return r1(60 / min);
}

/** Libellés de plage d'une discipline, zone par zone. */
export function rangeLabels(kind: ZoneKind, c: Cuts): string[] {
  if (kind === "pace") {
    const p = c.map(paceOf);
    return [`> ${p[0]}`, `${p[1]}-${p[0]}`, `${p[2]}-${p[1]}`, `${p[3]}-${p[2]}`, `< ${p[3]}`];
  }
  return [`< ${c[0]}`, `${c[0]}-${c[1] - 1}`, `${c[1]}-${c[2] - 1}`, `${c[2]}-${c[3] - 1}`, `≥ ${c[3]}`];
}

export function pctLabels(c: Cuts, ref: number): string[] {
  const p = c.map((v) => r((v / ref) * 100));
  return [`< ${p[0]} %`, `${p[0]}-${p[1]} %`, `${p[1]}-${p[2]} %`, `${p[2]}-${p[3]} %`, `> ${p[3]} %`];
}
