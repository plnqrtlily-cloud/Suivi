// Périodisation de l'entraînement — logique pure, sans base ni React, pour
// rester testable en isolation (cf. scripts/e2e-check.ts).
//
// Vocabulaire retenu, aligné sur celui déjà employé dans le bilan :
//   Saison (macrocycle, 6-12 mois) > Bloc (mésocycle long, 8-12 sem.)
//   > Cycle (mésocycle, 3-6 sem.) ; la semaine (microcycle) n'est pas stockée,
//   elle se déduit du calendrier.
//
// Les orientations reprennent le modèle par blocs d'Issurin (accumulation /
// transmutation / réalisation) et les phases classiques de la planification
// annuelle (préparation générale puis spécifique, compétition, transition).

import { toISODate } from "./dates";

export type PeriodLevel = "saison" | "bloc" | "cycle";

export const PERIOD_LEVELS: { value: PeriodLevel; label: string; hint: string }[] = [
  { value: "saison", label: "Saison", hint: "Macrocycle — 6 à 12 mois, jusqu'à l'objectif principal" },
  { value: "bloc", label: "Bloc", hint: "8 à 12 semaines, regroupe plusieurs cycles" },
  { value: "cycle", label: "Cycle", hint: "Mésocycle — 3 à 6 semaines, une qualité dominante" },
];

export type PeriodFocus =
  | "general"
  | "specifique"
  | "accumulation"
  | "transmutation"
  | "realisation"
  | "competition"
  | "transition";

export interface FocusPreset {
  value: PeriodFocus;
  label: string;
  /** Ce que la période cherche à développer, en une phrase. */
  description: string;
  /** Durée habituelle en semaines, utilisée pour pré-remplir le formulaire. */
  typicalWeeks: number;
  volume: "faible" | "modéré" | "élevé";
  intensity: "faible" | "modérée" | "élevée" | "maximale";
  /** Teinte de la bande sur le calendrier. */
  color: string;
}

// Volumes et intensités indicatifs : ils décrivent la dominante de la période,
// pas une prescription — le coach les ajuste à la création.
export const FOCUS_PRESETS: FocusPreset[] = [
  {
    value: "general",
    label: "Préparation générale",
    description: "Construire le socle : volume, fondamentaux techniques, tolérance à la charge.",
    typicalWeeks: 6,
    volume: "élevé",
    intensity: "faible",
    color: "#6B7A8A",
  },
  {
    value: "accumulation",
    label: "Accumulation",
    description: "Volume élevé à intensité modérée sur une qualité dominante : on stocke le travail.",
    typicalWeeks: 4,
    volume: "élevé",
    intensity: "modérée",
    color: "#1B4B4F",
  },
  {
    value: "specifique",
    label: "Préparation spécifique",
    description: "Rapprocher le travail des exigences de la compétition visée.",
    typicalWeeks: 4,
    volume: "modéré",
    intensity: "élevée",
    color: "#0F3336",
  },
  {
    value: "transmutation",
    label: "Transformation",
    description: "Convertir les gains en qualité spécifique : intensité qui monte, volume qui baisse.",
    typicalWeeks: 3,
    volume: "modéré",
    intensity: "élevée",
    color: "#B85A3E",
  },
  {
    value: "realisation",
    label: "Réalisation / affûtage",
    description: "Faire tomber la fatigue en gardant l'intensité : volume réduit, fréquence maintenue.",
    typicalWeeks: 2,
    volume: "faible",
    intensity: "maximale",
    color: "#E8896A",
  },
  {
    value: "competition",
    label: "Compétition",
    description: "Période de courses ou de matchs : entretien entre les échéances.",
    typicalWeeks: 3,
    volume: "faible",
    intensity: "maximale",
    color: "#7C5C46",
  },
  {
    value: "transition",
    label: "Transition / récupération",
    description: "Coupure active après la compétition : récupération physique et mentale.",
    typicalWeeks: 3,
    volume: "faible",
    intensity: "faible",
    color: "#9AA39C",
  },
];

export function focusPreset(focus: string | null | undefined): FocusPreset | null {
  return FOCUS_PRESETS.find((f) => f.value === focus) ?? null;
}

export function focusLabel(focus: string | null | undefined): string {
  return focusPreset(focus)?.label ?? "Sans orientation";
}

export function periodColor(focus: string | null | undefined, custom?: string | null): string {
  if (custom) return custom;
  return focusPreset(focus)?.color ?? "#9AA39C";
}

// --- Schémas de charge -----------------------------------------------------
// La progression de charge se lit en semaines : on empile N semaines montantes
// puis une semaine de décharge (assimilation). 3:1 est le schéma classique de
// l'athlète confirmé, 2:1 convient au débutant ou au vétéran qui récupère plus
// lentement, 4:1 à l'athlète très entraîné. « plat » = aucune décharge
// programmée (utile sur une période de compétition ou de transition).

/**
 * Schéma de charge : un des modèles ("3:1", "2:1", "4:1", "plat"), un ratio
 * libre ("5:2" = 5 semaines de charge puis 2 de décharge) ou un schéma saisi
 * semaine par semaine ("perso:CCDCCCD", C = charge, D = décharge).
 */
export type LoadPattern = string;

export const LOAD_PATTERNS: { value: LoadPattern; label: string; hint: string }[] = [
  { value: "3:1", label: "3:1", hint: "3 semaines de charge, 1 de décharge — le schéma le plus courant" },
  { value: "2:1", label: "2:1", hint: "2 semaines de charge, 1 de décharge — débutant, vétéran, retour de blessure" },
  { value: "4:1", label: "4:1", hint: "4 semaines de charge, 1 de décharge — athlète très entraîné" },
  { value: "plat", label: "Sans décharge", hint: "Charge régulière — compétition, transition" },
];

/** Normalise un schéma saisi ; null s'il n'est pas reconnu. */
export function normalizeLoadPattern(raw: string | null | undefined): LoadPattern | null {
  const v = String(raw || "").trim();
  if (!v) return null;
  if (v === "plat") return v;
  const perso = /^perso:([CD]{1,104})$/.exec(v);
  if (perso) return v;
  const r = /^(\d{1,2}):(\d)$/.exec(v);
  if (r && Number(r[1]) >= 1 && Number(r[1]) <= 12 && Number(r[2]) >= 1 && Number(r[2]) <= 4) return `${Number(r[1])}:${Number(r[2])}`;
  return null;
}

/** Libellé court d'un schéma (« 3:1 », « Sans décharge », « Personnalisé »). */
export function loadPatternLabel(pattern: LoadPattern | null | undefined): string {
  if (!pattern || pattern === "plat") return "Sans décharge";
  if (pattern.startsWith("perso:")) return "Personnalisé";
  return pattern;
}

/** Phrase d'explication d'un schéma pour une période de `weeks` semaines. */
export function loadPatternHint(pattern: LoadPattern | null | undefined, weeks: number): string {
  if (!pattern || pattern === "plat") return "charge régulière";
  if (pattern.startsWith("perso:")) {
    const d = deloadWeeks(pattern, weeks);
    return d.length ? `décharge en semaine${d.length > 1 ? "s" : ""} ${d.join(", ").replace(/, (\d+)$/, " et $1")}` : "aucune semaine de décharge";
  }
  const [n, m] = pattern.split(":");
  return `${n} semaine${Number(n) > 1 ? "s" : ""} de charge, ${m} de décharge`;
}

/** Rang (1-indexé) des semaines de décharge d'une période de `weeks` semaines. */
export function deloadWeeks(pattern: LoadPattern | null | undefined, weeks: number): number[] {
  if (!pattern || pattern === "plat" || weeks < 1) return [];
  if (pattern.startsWith("perso:")) {
    const out: number[] = [];
    const seq = pattern.slice(6);
    for (let i = 0; i < Math.min(seq.length, weeks); i++) if (seq[i] === "D") out.push(i + 1);
    return out;
  }
  const r = /^(\d{1,2}):(\d)$/.exec(pattern);
  if (!r || weeks < 2) return [];
  const n = Number(r[1]);
  const d = Number(r[2]);
  const out: number[] = [];
  for (let start = 0; start + n < weeks; start += n + d) {
    for (let k = 1; k <= d && start + n + k <= weeks; k++) out.push(start + n + k);
  }
  return out;
}

// --- Bornes et durées ------------------------------------------------------

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Nombre de jours inclusifs entre deux dates ISO. */
export function periodDays(startISO: string, endISO: string): number {
  const [y1, m1, d1] = startISO.split("-").map(Number);
  const [y2, m2, d2] = endISO.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / 86400000) + 1;
}

/** Nombre de semaines entamées couvertes par la période. */
export function periodWeeks(startISO: string, endISO: string): number {
  return Math.max(1, Math.ceil(periodDays(startISO, endISO) / 7));
}

/** Date de fin d'une période démarrant à `startISO` et durant `weeks` semaines. */
export function endDateForWeeks(startISO: string, weeks: number): string {
  const d = parseISO(startISO);
  d.setDate(d.getDate() + weeks * 7 - 1);
  return toISODate(d);
}

export function overlaps(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export interface PeriodLike {
  id: string;
  level: string;
  name: string;
  focus: string | null;
  start_date: string;
  end_date: string;
  load_pattern: string | null;
  color: string | null;
}

/** Périodes actives à une date donnée, du plus large au plus fin. */
export function periodsOnDate<T extends PeriodLike>(periods: T[], dateISO: string): T[] {
  const order: Record<string, number> = { saison: 0, bloc: 1, cycle: 2 };
  return periods
    .filter((p) => p.start_date <= dateISO && dateISO <= p.end_date)
    .sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9));
}

/**
 * Position d'une date dans une période : rang de semaine (1-indexé) et statut
 * de décharge. Sert à afficher « S3/4 · décharge » sur le calendrier, ce qui
 * est l'information qu'un coach lit en un coup d'œil pour savoir où il en est.
 */
export function weekPosition(
  period: PeriodLike,
  dateISO: string
): { week: number; totalWeeks: number; isDeload: boolean } | null {
  if (dateISO < period.start_date || dateISO > period.end_date) return null;
  const week = Math.floor((periodDays(period.start_date, dateISO) - 1) / 7) + 1;
  const totalWeeks = periodWeeks(period.start_date, period.end_date);
  return { week, totalWeeks, isDeload: deloadWeeks(period.load_pattern, totalWeeks).includes(week) };
}

// --- Modèles de bloc -------------------------------------------------------
// Construire un bloc complet à la main, cycle par cycle, est le geste le plus
// fastidieux de la planification. Ces modèles créent le bloc ET ses cycles en
// une fois, à partir d'une simple date de début.

export interface BlockTemplateStep {
  focus: PeriodFocus;
  weeks: number;
}

export interface BlockTemplate {
  value: string;
  label: string;
  description: string;
  loadPattern: LoadPattern;
  steps: BlockTemplateStep[];
}

export const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    value: "blocs-issurin",
    label: "Blocs (accumulation → transformation → réalisation)",
    description: "Le modèle par blocs : une qualité à la fois, concentrée, puis convertie avant l'échéance.",
    loadPattern: "3:1",
    steps: [
      { focus: "accumulation", weeks: 4 },
      { focus: "transmutation", weeks: 3 },
      { focus: "realisation", weeks: 2 },
    ],
  },
  {
    value: "classique",
    label: "Classique (général → spécifique → compétition)",
    description: "La planification traditionnelle : socle large, puis spécialisation progressive.",
    loadPattern: "3:1",
    steps: [
      { focus: "general", weeks: 6 },
      { focus: "specifique", weeks: 4 },
      { focus: "competition", weeks: 2 },
    ],
  },
  {
    value: "reprise",
    label: "Reprise / retour de blessure",
    description: "Remontée prudente : décharge tous les deux blocs de travail, intensité tardive.",
    loadPattern: "2:1",
    steps: [
      { focus: "general", weeks: 4 },
      { focus: "accumulation", weeks: 3 },
      { focus: "specifique", weeks: 3 },
    ],
  },
  {
    value: "entretien",
    label: "Entretien en saison",
    description: "Période de compétitions rapprochées : on entretient, on ne construit pas.",
    loadPattern: "plat",
    steps: [
      { focus: "competition", weeks: 6 },
      { focus: "transition", weeks: 2 },
    ],
  },
];

export function blockTemplate(value: string): BlockTemplate | null {
  return BLOCK_TEMPLATES.find((t) => t.value === value) ?? null;
}

/** Dates de chaque cycle d'un modèle, enchaînés sans trou à partir du début. */
export function expandTemplate(
  template: BlockTemplate,
  startISO: string
): { focus: PeriodFocus; start: string; end: string; weeks: number }[] {
  const out: { focus: PeriodFocus; start: string; end: string; weeks: number }[] = [];
  let cursor = startISO;
  for (const step of template.steps) {
    const end = endDateForWeeks(cursor, step.weeks);
    out.push({ focus: step.focus, start: cursor, end, weeks: step.weeks });
    const next = parseISO(end);
    next.setDate(next.getDate() + 1);
    cursor = toISODate(next);
  }
  return out;
}

/** Durée totale d'un modèle, pour l'afficher avant de le choisir. */
export function templateWeeks(template: BlockTemplate): number {
  return template.steps.reduce((s, x) => s + x.weeks, 0);
}
