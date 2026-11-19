import { mtbLabel } from "./mtb";
// Types d'événements du calendrier partagé — fichier sans import serveur,
// utilisable par les composants client.

export const EVENT_KINDS = [
  { value: "entrainement", label: "Entraînement", color: "#3f6f6c" },
  { value: "competition", label: "Compétition", color: "#a4492a" },
  { value: "stage", label: "Stage", color: "#1b4b4f" },
  { value: "rdv", label: "Rendez-vous", color: "#e8896a" },
  { value: "deplacement", label: "Déplacement", color: "#5b6660" },
  { value: "autre", label: "Autre", color: "#182220" },
] as const;

export type EventKind = (typeof EVENT_KINDS)[number]["value"];

export function eventKind(kind: string) {
  return EVENT_KINDS.find((k) => k.value === kind) ?? EVENT_KINDS[EVENT_KINDS.length - 1];
}

/** Événement tel qu'affiché : `mine` = saisi par la personne qui regarde. */
export interface CalendarEventView {
  id: string;
  athleteId: string;
  kind: EventKind;
  title: string;
  startDate: string;
  endDate: string;
  time: string | null;
  location: string | null;
  notes: string | null;
  /** Entraînement : sport et durée prévue. */
  sport: string | null;
  /** Type de VTT (cf. src/lib/mtb.ts), pour un entraînement vélo. */
  discipline?: string | null;
  durationMinutes: number | null;
  /** Dénivelé positif prévu (m). */
  elevationGainM?: number | null;
  authorName: string;
  mine: boolean;
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function dm(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]}`;
}

/** « 12 déc. », « 12 → 14 déc. », « 30 nov. → 2 déc. » */
export function eventDateLabel(start: string, end: string) {
  if (start === end) return dm(start);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8)) === 1 ? "1er" : Number(start.slice(8))} → ${dm(end)}`;
  return `${dm(start)} → ${dm(end)}`;
}

/** Sports où le dénivelé positif a du sens. */
export const ELEVATION_SPORTS = ["mtb", "cycling", "running", "hiking", "trail"];

export const TRAINING_SPORTS = [
  { value: "mtb", label: "VTT" },
  { value: "cycling", label: "Vélo route" },
  { value: "running", label: "Course à pied" },
  { value: "strength", label: "Musculation" },
  { value: "hiking", label: "Randonnée" },
  { value: "swimming", label: "Natation" },
  { value: "climbing", label: "Escalade" },
  { value: "other", label: "Autre" },
];

function minutesLabel(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} h${r ? ` ${String(r).padStart(2, "0")}` : ""}` : `${r} min`;
}

// Sport déduit du titre saisi (« Muscu haut du corps » → Musculation), pour
// ne pas avoir à le rechercher dans la liste. Null si rien ne correspond.
const SPORT_WORDS: [RegExp, string][] = [
  [/muscu|renfo|gainage|force|squat|souleve|developpe|halt|fonte|crossfit|circuit|pliom|plyo|gym|core/, "strength"],
  [/course|footing|trail|fractionne|vma|jogging|\brun/, "running"],
  [/vtt|enduro|descente|\bdh\b|dirt|vttae|e-?bike|pump ?track|bike ?park/, "mtb"],
  [/velo|route|home ?trainer|bike|gravel|sortie/, "cycling"],
  [/nata|piscine|nage|swim/, "swimming"],
  [/rando|marche|hike/, "hiking"],
  [/escalade|grimpe|bloc|climb/, "climbing"],
];
/** Type de VTT déduit du titre (« Enduro Finale » → enduro). */
export function guessMtbFromTitle(title: string): string | null {
  const t = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/enduro/.test(t)) return "enduro";
  if (/vttae|electrique|e-?bike|\bvae\b/.test(t)) return "vttae";
  if (/descente|\bdh\b|bike ?park/.test(t)) return "dh";
  if (/dirt|pump ?track/.test(t)) return "dirt";
  return null;
}

export function guessSportFromTitle(title: string): string | null {
  const t = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return SPORT_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
}

/**
 * Sous-titre d'un événement : type · date(s) ou heure · lieu · auteur.
 * `you` : « toi » côté athlète, « vous » côté coach (registre de chaque espace).
 */
export function eventSubtitle(e: CalendarEventView, you: "toi" | "vous" = "toi") {
  const multi = e.startDate !== e.endDate;
  const training = e.kind === "entrainement" ? [mtbLabel(e.discipline) ?? TRAINING_SPORTS.find((s) => s.value === e.sport)?.label, e.durationMinutes ? minutesLabel(e.durationMinutes) : null, e.elevationGainM ? `D+ ${e.elevationGainM} m` : null] : [];
  return [e.kind === "entrainement" && e.sport ? null : eventKind(e.kind).label, ...training, multi ? eventDateLabel(e.startDate, e.endDate) : e.time, e.location, e.mine ? `par ${you}` : `par ${e.authorName}`]
    .filter(Boolean)
    .join(" · ");
}

/** Événements qui couvrent ce jour (un événement sur plusieurs jours apparaît chaque jour). */
export function eventsOn<T extends { startDate: string; endDate: string }>(events: T[], date: string): T[] {
  return events.filter((e) => e.startDate <= date && e.endDate >= date);
}
