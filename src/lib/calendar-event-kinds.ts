// Types d'événements du calendrier partagé — fichier sans import serveur,
// utilisable par les composants client.

export const EVENT_KINDS = [
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

/**
 * Sous-titre d'un événement : type · date(s) ou heure · lieu · auteur.
 * `you` : « toi » côté athlète, « vous » côté coach (registre de chaque espace).
 */
export function eventSubtitle(e: CalendarEventView, you: "toi" | "vous" = "toi") {
  const multi = e.startDate !== e.endDate;
  return [eventKind(e.kind).label, multi ? eventDateLabel(e.startDate, e.endDate) : e.time, e.location, e.mine ? `par ${you}` : `par ${e.authorName}`]
    .filter(Boolean)
    .join(" · ");
}

/** Événements qui couvrent ce jour (un événement sur plusieurs jours apparaît chaque jour). */
export function eventsOn<T extends { startDate: string; endDate: string }>(events: T[], date: string): T[] {
  return events.filter((e) => e.startDate <= date && e.endDate >= date);
}
