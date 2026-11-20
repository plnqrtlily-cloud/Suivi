// Types de VTT proposés quand on renseigne une sortie (séance du coach,
// activité réalisée, entraînement au calendrier). Le sport en base reste
// « cycling » (charge, zones, stats vélo) ; le type est rangé à côté
// (colonne discipline, ou plan_json.discipline pour une séance). Sans
// dépendance serveur.
// « Cyclisme » : une seule catégorie, à préciser (route, enduro, DH, dirt,
// BMX, home trainer, VTT électrique).
export const MTB_DISCIPLINES = [
  { value: "route", label: "Route", long: "Vélo route" },
  { value: "enduro", label: "Enduro", long: "VTT enduro" },
  { value: "dh", label: "DH", long: "VTT DH" },
  { value: "dirt", label: "Dirt", long: "Dirt" },
  { value: "bmx", label: "BMX", long: "BMX" },
  { value: "home_trainer", label: "Home trainer", long: "Home trainer" },
  { value: "vttae", label: "Électrique", long: "VTT électrique" },
] as const;

/** Types de cyclisme sans parcours ni dénivelé (sur place). */
export const INDOOR_CYCLING = ["home_trainer"];

export type MtbDiscipline = (typeof MTB_DISCIPLINES)[number]["value"];

export function isMtbDiscipline(v: unknown): v is MtbDiscipline {
  return MTB_DISCIPLINES.some((d) => d.value === v);
}

/** « VTT enduro », « VTT DH »… ; « VTT » pour un VTT sans type précisé. */
export function mtbLabel(discipline: string | null | undefined): string | null {
  if (discipline === "mtb") return "VTT";
  return MTB_DISCIPLINES.find((d) => d.value === discipline)?.long ?? null;
}

/** Valeur à enregistrer à partir d'un formulaire (type choisi, ou VTT générique). */
export function parseDiscipline(v: FormDataEntryValue | string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  if (isMtbDiscipline(s) || s === "mtb") return s;
  return null;
}
