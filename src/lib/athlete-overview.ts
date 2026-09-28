// Aperçu de la fiche athlète : charge et forme semaine par semaine, et les
// quelques points qui méritent l'attention du coach. Calculs purs (aucune
// requête) pour rester testables ; le composant client ne fait qu'afficher.

import type { Workout, ImportedActivity, TrainingPeriod } from "./queries";
import type { Checkin } from "./checkin-types";
import { computeGlobalScore } from "./checkin-types";
import { sessionLoad, type AcwrResult } from "./training-stats";
import { periodsOnDate } from "./periodization";
import { cycleDayForDate } from "./cycle-types";

export interface LoadWeek {
  weekStart: string;
  number: number;
  period: string | null;
  load: number;
  plannedLoad: number;
  minutes: number;
  plannedMinutes: number;
  done: number;
  total: number;
  forme: number | null;
  isCurrent: boolean;
  isFuture: boolean;
}

export interface OverviewStat {
  label: string;
  value: string;
  hint: string;
}

export interface AttentionItem {
  tone: "alert" | "warn" | "info";
  title: string;
  text: string;
  action?: { label: string; href: string };
}

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(dateISO: string, n: number): string {
  const d = parse(dateISO);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function mondayOf(dateISO: string): string {
  const d = parse(dateISO);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return iso(d);
}

export function isoWeekNumber(dateISO: string): number {
  const d = parse(dateISO);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function dayName(dateISO: string): string {
  return DAYS[parse(dateISO).getDay()];
}

export function shortDate(dateISO: string): string {
  const d = parse(dateISO);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

export function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ");
}

function fmtScore(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

const isGoal = (w: Workout) => w.category === "objectif" || w.category === "evenement";

/**
 * Semaines de `fromMonday` à `toMonday` inclus. Charge réalisée = séances
 * faites ou partielles + activités importées hors programme ; charge prévue =
 * durée prévue × RPE visé des séances programmées (brouillons exclus).
 */
export function buildLoadWeeks(params: {
  workouts: Workout[];
  imports: ImportedActivity[];
  checkins: Checkin[];
  periods: TrainingPeriod[];
  fromMonday: string;
  toMonday: string;
  today: string;
}): LoadWeek[] {
  const { workouts, imports, checkins, periods, fromMonday, toMonday, today } = params;
  const currentMonday = mondayOf(today);
  const byWeek = new Map<string, LoadWeek>();
  const formes = new Map<string, number[]>();
  for (let m = fromMonday; m <= toMonday; m = addDays(m, 7)) {
    const active = periodsOnDate(periods, addDays(m, 3));
    byWeek.set(m, {
      weekStart: m,
      number: isoWeekNumber(m),
      period: active.length ? active[active.length - 1].name : null,
      load: 0,
      plannedLoad: 0,
      minutes: 0,
      plannedMinutes: 0,
      done: 0,
      total: 0,
      forme: null,
      isCurrent: m === currentMonday,
      isFuture: m > currentMonday,
    });
  }
  const end = addDays(toMonday, 6);
  for (const w of workouts) {
    if (w.date < fromMonday || w.date > end || w.is_draft) continue;
    if (w.status === "cancelled") continue;
    const wk = byWeek.get(mondayOf(w.date));
    if (!wk) continue;
    if (isGoal(w) && !w.duration_minutes) continue;
    wk.total++;
    wk.plannedMinutes += w.duration_minutes || 0;
    wk.plannedLoad += sessionLoad(w.duration_minutes, w.planned_rpe ?? null);
    if (w.status === "done" || w.status === "partial") {
      wk.done++;
      const m = w.actual_duration_minutes ?? w.duration_minutes ?? 0;
      wk.minutes += m;
      wk.load += sessionLoad(m, w.rpe);
    }
  }
  for (const a of imports) {
    if (a.workout_id) continue;
    const wk = byWeek.get(mondayOf(a.activity_date));
    if (!wk) continue;
    wk.minutes += a.duration_minutes || 0;
    wk.load += sessionLoad(a.duration_minutes, a.rpe);
  }
  for (const c of checkins) {
    const key = mondayOf(c.check_date);
    if (!byWeek.has(key)) continue;
    (formes.get(key) ?? formes.set(key, []).get(key)!).push(computeGlobalScore(c));
  }
  for (const [key, list] of formes) {
    const wk = byWeek.get(key)!;
    wk.forme = Math.round((list.reduce((s, v) => s + v, 0) / list.length) * 10) / 10;
  }
  return [...byWeek.values()].map((w) => ({ ...w, load: Math.round(w.load), plannedLoad: Math.round(w.plannedLoad) }));
}

/** Chiffres de la colonne de droite : les 4 dernières semaines complètes. */
export function overviewStats(weeks: LoadWeek[], acwr: AcwrResult): OverviewStat[] {
  const past = weeks.filter((w) => !w.isCurrent && !w.isFuture);
  const last4 = past.slice(-4);
  const prev4 = past.slice(-8, -4);
  const avg = (list: LoadWeek[], f: (w: LoadWeek) => number) =>
    list.length ? list.reduce((s, w) => s + f(w), 0) / list.length : 0;

  const vol = avg(last4, (w) => w.minutes);
  const volPrev = avg(prev4, (w) => w.minutes);
  const trend = volPrev > 0 ? Math.round(((vol - volPrev) / volPrev) * 100) : null;
  const done = last4.reduce((s, w) => s + w.done, 0);
  const total = last4.reduce((s, w) => s + w.total, 0);
  const load = avg(last4, (w) => w.load);
  const peak = last4.reduce<LoadWeek | null>((best, w) => (!best || w.load > best.load ? w : best), null);

  const acwrText =
    acwr.status === "insufficient_data"
      ? "pas assez d'historique"
      : acwr.status === "high_risk"
        ? "hausse rapide de la charge"
        : acwr.status === "low"
          ? "charge en net repli"
          : "dans la zone habituelle";

  return [
    {
      label: "Volume hebdo moyen",
      value: last4.length ? fmtMinutes(vol) : "—",
      hint: trend === null ? "sur les 4 dernières semaines" : `${trend > 0 ? "+" : ""}${trend} % sur les 4 semaines d'avant`,
    },
    {
      label: "Séances faites",
      value: total ? `${Math.round((done / total) * 100)} %` : "—",
      hint: total ? `${done} sur ${total} prévues` : "aucune séance prévue",
    },
    {
      label: "Charge hebdo moyenne",
      value: last4.length ? `${fmtNumber(load)} UA` : "—",
      hint: peak && peak.load > 0 ? `semaine la plus chargée : S${peak.number}` : "durée × RPE",
    },
    {
      label: "Charge aiguë / chronique",
      value: acwr.ratio !== null ? String(acwr.ratio).replace(".", ",") : "—",
      hint: acwrText,
    },
  ];
}

/**
 * Points à regarder, du plus urgent au moins urgent. Rien de ce qui se lit
 * déjà d'un coup d'œil dans le calendrier (séance du jour, prochaine séance) :
 * seulement les écarts qui demandent une décision.
 */
export function buildAttention(params: {
  athleteId: string;
  firstName: string;
  today: string;
  workouts: Workout[];
  checkins: Checkin[];
  weeks: LoadWeek[];
  acwr: AcwrResult;
  activeInjury: { zone: string; date_start: string } | null;
  unread: { count: number; last?: { body: string; created_at: string } };
  hasUpcoming: boolean;
}): AttentionItem[] {
  const { athleteId, firstName, today, workouts, checkins, weeks, acwr, activeInjury, unread } = params;
  const base = `/coach/athletes/${athleteId}`;
  const items: AttentionItem[] = [];

  if (activeInjury) {
    items.push({
      tone: "alert",
      title: `Blessure en cours : ${activeInjury.zone.toLowerCase()}`,
      text: `Déclarée le ${shortDate(activeInjury.date_start)}. À garder en tête pour les séances à venir.`,
      action: { label: "Voir la santé", href: `${base}?tab=sante` },
    });
  }

  // Forme : un creux net sur les 7 derniers jours par rapport à la moyenne du mois.
  const recent = checkins.filter((c) => c.check_date > addDays(today, -7));
  const month = checkins.filter((c) => c.check_date > addDays(today, -28));
  if (recent.length >= 2 && month.length >= 4) {
    const scores = recent.map((c) => ({ c, s: computeGlobalScore(c) }));
    const low = scores.reduce((a, b) => (b.s < a.s ? b : a));
    const mean = month.reduce((s, c) => s + computeGlobalScore(c), 0) / month.length;
    if (low.s <= mean - 1.5 || low.s < 5) {
      const first = scores[0];
      const last = scores[scores.length - 1];
      const note = low.c.notes ? ` (« ${low.c.notes.slice(0, 60)}${low.c.notes.length > 60 ? "…" : ""} »)` : "";
      const parts = [
        first.c.check_date !== low.c.check_date ? `${fmtScore(first.s)} ${dayName(first.c.check_date)} → ` : "",
        `${fmtScore(low.s)} ${dayName(low.c.check_date)}${note}`,
        last.c.check_date !== low.c.check_date
          ? `, ${last.s > low.s ? "remontée" : "encore"} à ${fmtScore(last.s)} ${last.c.check_date === today ? "aujourd'hui" : dayName(last.c.check_date)}`
          : "",
      ];
      items.push({
        tone: low.s < 5 ? "alert" : "warn",
        title: last.c.check_date === low.c.check_date ? "Forme basse" : "Forme en baisse cette semaine",
        text: `${parts.join("")}.`,
        action: { label: "Voir la forme", href: `${base}?view=week` },
      });
    }
  }

  // Séances des 7 derniers jours non faites ou coupées.
  const missed = workouts
    .filter(
      (w) =>
        !w.is_draft &&
        w.date < today &&
        w.date >= addDays(today, -7) &&
        (w.status === "partial" || w.status === "not_done")
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2);
  for (const w of missed) {
    const partial = w.status === "partial";
    const text =
      partial && w.actual_duration_minutes && w.duration_minutes
        ? `${w.title} coupée à ${fmtMinutes(w.actual_duration_minutes)} sur ${fmtMinutes(w.duration_minutes)} prévue.`
        : w.athlete_feedback
          ? `${w.title} · « ${w.athlete_feedback.slice(0, 80)} »`
          : w.title;
    items.push({
      tone: "warn",
      title: `Séance ${partial ? "partielle" : "non faite"} ${dayName(w.date)}`,
      text,
      action: { label: "Ouvrir la séance", href: `${base}/day/${w.date}` },
    });
  }

  // Semaine prochaine nettement plus chargée que la semaine en cours.
  const cur = weeks.find((w) => w.isCurrent);
  const next = weeks.find((w) => w.isFuture);
  if (cur && next && cur.plannedLoad > 0 && next.plannedLoad > 0) {
    const delta = Math.round(((next.plannedLoad - cur.plannedLoad) / cur.plannedLoad) * 100);
    if (delta >= 30) {
      items.push({
        tone: delta >= 50 ? "alert" : "warn",
        title: `Semaine prochaine : +${delta} % de charge`,
        text: `${fmtNumber(next.plannedLoad)} UA prévues contre ${fmtNumber(cur.plannedLoad)} cette semaine${next.period ? `, en ${next.period}` : ""}.`,
        action: { label: `Voir la semaine ${next.number}`, href: `${base}?view=week&week=1` },
      });
    }
  }

  if (acwr.status === "high_risk") {
    items.push({
      tone: "alert",
      title: "Charge en hausse rapide",
      text: `Charge des 7 derniers jours ${fmtNumber(acwr.acuteLoad)} UA pour une moyenne de ${fmtNumber(acwr.chronicWeeklyLoad)} UA par semaine sur 4 semaines (ratio ${String(acwr.ratio).replace(".", ",")}).`,
    });
  }

  if (!params.hasUpcoming) {
    items.push({
      tone: "info",
      title: "Plus rien de programmé",
      text: `Aucune séance prévue pour ${firstName} après aujourd'hui.`,
      action: { label: "Ouvrir le calendrier", href: `${base}?view=week` },
    });
  }

  if (unread.count > 0) {
    const last = unread.last;
    const when = last ? `${dayName(last.created_at.slice(0, 10))} ${last.created_at.slice(11, 16).replace(":", "h")}` : "";
    items.push({
      tone: "info",
      title: unread.count > 1 ? `${unread.count} messages de ${firstName} sans réponse` : `Un message de ${firstName} sans réponse`,
      text: last ? `« ${last.body.slice(0, 90)}${last.body.length > 90 ? "…" : ""} » · ${when}` : "",
      action: { label: "Répondre", href: `${base}/messages` },
    });
  }

  return items;
}

/**
 * Étendue affichée dans la frise de périodisation : la saison en cours s'il y
 * en a une, sinon toutes les périodes, sinon les 6 mois autour d'aujourd'hui.
 */
export function seasonSpan(
  periods: TrainingPeriod[],
  today: string
): { from: string; to: string; season: TrainingPeriod | null } {
  const seasons = periods.filter((p) => p.level === "saison");
  const season =
    seasons.find((p) => p.start_date <= today && today <= p.end_date) ??
    seasons.filter((p) => p.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ??
    null;
  if (season) return { from: season.start_date, to: season.end_date, season };
  if (periods.length) {
    return {
      from: periods.reduce((m, p) => (p.start_date < m ? p.start_date : m), periods[0].start_date),
      to: periods.reduce((m, p) => (p.end_date > m ? p.end_date : m), periods[0].end_date),
      season: null,
    };
  }
  return { from: addDays(today, -91), to: addDays(today, 91), season: null };
}

export interface CycleSummary {
  rows: { label: string; value: string }[];
  current: string | null;
  insight: string | null;
}

/**
 * Lecture du cycle partagé pour l'onglet Santé : moyennes, phase du jour,
 * prochaines dates estimées, et la forme de l'athlète selon la phase quand
 * les check-ins le permettent. Estimations simples, présentées comme telles.
 */
export function cycleSummary(params: {
  periodStarts: string[];
  settings: { average_cycle_length_days: number; average_period_length_days: number };
  checkins: Checkin[];
  today: string;
  firstName: string;
}): CycleSummary {
  const { periodStarts, settings, checkins, today, firstName } = params;
  const starts = [...periodStarts].filter((d) => d <= today).sort();
  const gaps: number[] = [];
  for (let i = Math.max(1, starts.length - 6); i < starts.length; i++) {
    const g = Math.round((parse(starts[i]).getTime() - parse(starts[i - 1]).getTime()) / 86400000);
    if (g >= 18 && g <= 45) gaps.push(g);
  }
  const len = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : settings.average_cycle_length_days || 28;
  const periodLen = settings.average_period_length_days || 5;
  const conf = { average_cycle_length_days: len, average_period_length_days: periodLen };
  const rows: { label: string; value: string }[] = [
    { label: "Cycle moyen", value: `${len} jours` },
    { label: "Règles", value: `${periodLen} jours en moyenne` },
  ];
  if (!starts.length) return { rows, current: null, insight: null };

  const cur = cycleDayForDate(starts, conf, today);
  const anchor = addDays(today, -((cur?.day ?? 1) - 1));
  const ovuStart = Math.ceil(len / 2 - 2);
  const ovuMid = Math.round(len / 2);
  const nextStart = addDays(anchor, len);
  // Avant l'ovulation du cycle en cours, on annonce celles de ce cycle ;
  // après, celles du suivant.
  const base = cur && cur.day - 1 < ovuStart ? anchor : nextStart;
  const follFrom = addDays(base, periodLen);
  const follTo = addDays(base, ovuStart - 1);
  if (base === anchor && cur && cur.key === "foll") {
    rows.push({ label: "Phase folliculaire", value: `jusqu'au ${shortDate(follTo)}` });
  } else if (base === nextStart || (cur && cur.key === "regles")) {
    rows.push({ label: "Phase folliculaire", value: `du ${shortDate(follFrom)} au ${shortDate(follTo)}` });
  }
  rows.push({ label: "Ovulation estimée", value: `vers le ${shortDate(addDays(base, ovuMid - 1))}` });
  rows.push({ label: "Prochaines règles", value: `vers le ${shortDate(nextStart)}` });

  let insight: string | null = null;
  const since = starts.length >= 4 ? starts[starts.length - 4] : addDays(today, -3 * len);
  const endLut: number[] = [];
  const rest: number[] = [];
  for (const c of checkins) {
    if (c.check_date < since || c.check_date > today) continue;
    const d = cycleDayForDate(starts, conf, c.check_date);
    if (!d) continue;
    (d.key === "lut" && d.day > len - 5 ? endLut : rest).push(computeGlobalScore(c));
  }
  if (endLut.length >= 3 && rest.length >= 6) {
    const a = endLut.reduce((x, y) => x + y, 0) / endLut.length;
    const b = rest.reduce((x, y) => x + y, 0) / rest.length;
    if (Math.abs(a - b) >= 0.4) {
      insight = `Sur les derniers cycles, la forme moyenne de ${firstName} est de ${fmtScore(a)} en fin de phase lutéale contre ${fmtScore(b)} le reste du cycle.`;
    }
  }
  return { rows, current: cur?.text ?? null, insight };
}
