// Données du calendrier coach, déjà mises en forme côté serveur : le composant
// client n'a plus qu'à les afficher. Fichier sans import serveur.

import type { CycleDay } from "./cycle-types";

/**
 * todo : à faire · noreport : date passée sans retour de l'athlète ·
 * tovalidate : réalisée, retour pas encore validé par le coach · done :
 * réalisée et validée · miss : non réalisée · postponed : reportée · hors :
 * activité hors programme.
 */
export type EntryStatus = "todo" | "noreport" | "tovalidate" | "done" | "miss" | "postponed" | "hors";

export interface CalComment {
  id: string;
  who: string;
  init: string;
  mine: boolean;
  body: string;
  when: string;
}

export interface CalEntry {
  id: string;
  kind: "workout" | "import";
  date: string;
  title: string;
  sport: string;
  sportLabel: string;
  status: EntryStatus;
  isGoal: boolean;
  isDraft: boolean;
  plannedMin: number | null;
  plannedRpe: number | null;
  realMin: number | null;
  rpe: number | null;
  distanceKm: number | null;
  avgHr: number | null;
  elevation: number | null;
  power: number | null;
  timeLabel: string | null;
  description: string | null;
  content: string[];
  /** Objectifs chiffrés propres à la discipline (distance prévue, puissance cible…). */
  plan: { label: string; value: string }[];
  feedback: string | null;
  reportedByCoach: boolean;
  /** Entrée saisie par ce coach (activité hors programme) : lui seul peut la supprimer. */
  createdByMe: boolean;
  comments: CalComment[];
}

export interface CalBlock {
  id: string;
  label: string;
  reason: string | null;
  createdByMe: boolean;
}

export interface CalForme {
  score: number;
  label: string;
  physical: number;
  mental: number;
  sleep: number;
  soreness: number;
  stress: number;
  notes: string | null;
}

export interface CalDay {
  date: string;
  dow: string;
  num: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  entries: CalEntry[];
  blocks: CalBlock[];
  forme: CalForme | null;
  cycle: CycleDay | null;
}

export interface CalDiscipline {
  label: string;
  minutes: number;
  color: string;
}

export interface CalWeek {
  weekStart: string;
  number: number;
  period: string | null;
  load: number;
  plannedLoad: number;
  minutes: number;
  plannedMinutes: number;
  km: number;
  done: number;
  total: number;
  disciplines: CalDiscipline[];
  days: CalDay[];
}

export interface CoachCalendarData {
  athleteId: string;
  athleteName: string;
  view: "week" | "month";
  offset: number;
  month: string; // YYYY-MM
  prevMonth: string;
  nextMonth: string;
  today: string;
  title: string;
  subtitle: string;
  goal: { title: string; dateLabel: string; days: number } | null;
  stats: { load: number; plannedLoad: number; minutes: number; plannedMinutes: number; done: number; total: number };
  weeks: CalWeek[];
  cycleShared: boolean;
}
