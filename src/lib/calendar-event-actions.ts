"use server";

import { cleanRouteUrl } from "@/lib/route-url";
import { parseDiscipline } from "./mtb";
import { randomUUID } from "crypto";
import { revalidatePath as nextRevalidatePath, refresh } from "next/cache";
import { getCurrentUser } from "./auth";
import { dbGet, dbRun } from "./db";
import { EVENT_KINDS } from "./calendar-event-kinds";
import { canManageAthleteCalendar, getCalendarEvent, notifyEventChange } from "./calendar-events";
import { consecutiveRuns } from "./day-runs";

// Ajout, modification et suppression d'un événement du calendrier partagé,
// par l'athlète ou par l'un de ses coachs (cf. src/lib/calendar-events.ts).

// Invalide la page puis renvoie la page affichée à jour dans la même réponse
// que l'action (même principe que src/lib/actions.ts).
function revalidatePath(path: string) {
  nextRevalidatePath(path);
  try {
    refresh();
  } catch {
    // Hors d'une Server Action : l'invalidation suffit.
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export interface CalendarEventInput {
  athleteId?: string;
  kind: string;
  title: string;
  startDate: string;
  endDate?: string;
  /** À la création : jours choisis un par un ; un événement par suite de jours consécutifs. */
  dates?: string[];
  time?: string;
  location?: string;
  notes?: string;
  sport?: string;
  /** Type de VTT quand sport = « mtb » (cf. src/lib/mtb.ts). */
  discipline?: string | null;
  durationMinutes?: number;
  elevationGainM?: number;
  routeUrl?: string;
}

function clean(input: CalendarEventInput) {
  const title = input.title.trim().slice(0, 120);
  const kind = EVENT_KINDS.some((k) => k.value === input.kind) ? input.kind : "autre";
  const start = input.startDate;
  const end = input.endDate && input.endDate >= start ? input.endDate : start;
  if (!title) throw new Error("Donnez un titre à l'événement.");
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) throw new Error("Choisissez la date de l'événement.");
  const time = input.time && TIME_RE.test(input.time) && start === end ? input.time : null;
  return {
    title,
    kind,
    start_date: start,
    end_date: end,
    time,
    location: input.location?.trim().slice(0, 120) || null,
    notes: input.notes?.trim().slice(0, 2000) || null,
    // « VTT » : enregistré en vélo, avec son type à côté.
    sport: kind === "entrainement" && input.sport ? (input.sport === "mtb" ? "cycling" : input.sport.slice(0, 30)) : null,
    discipline: kind === "entrainement" && input.sport === "mtb" ? parseDiscipline(input.discipline) : null,
    route_url: kind === "entrainement" ? cleanRouteUrl(input.routeUrl) : null,
    elevation_gain_m:
      kind === "entrainement" && ["mtb", "cycling", "running", "hiking", "trail"].includes(input.sport ?? "") && input.elevationGainM && input.elevationGainM > 0
        ? Math.min(Math.round(input.elevationGainM), 20000)
        : null,
    duration_minutes: kind === "entrainement" && input.durationMinutes && input.durationMinutes > 0 ? Math.min(Math.round(input.durationMinutes), 1440) : null,
  };
}

function revalidateCalendars(athleteId: string, dates: string[]) {
  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath("/coach/planification");
  revalidatePath("/athlete/programmation");
  revalidatePath("/athlete");
  for (const d of dates) {
    revalidatePath(`/coach/athletes/${athleteId}/day/${d}`);
    revalidatePath(`/athlete/day/${d}`);
  }
}

async function requireManager(athleteId: string) {
  const user = await getCurrentUser();
  if (!user || !(await canManageAthleteCalendar(user, athleteId))) throw new Error("Non autorisé.");
  return user;
}

export async function createCalendarEventAction(input: CalendarEventInput) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Non autorisé.");
  const athleteId = me.role === "athlete" ? me.id : String(input.athleteId || "");
  const user = await requireManager(athleteId);
  const days = [...new Set((input.dates?.length ? input.dates : [input.startDate]).filter((d) => DATE_RE.test(d)))].sort().slice(0, 366);
  if (!days.length) throw new Error("Choisissez au moins un jour.");
  // Un entraînement par jour (deux sorties = deux entraînements) ; un
  // événement par suite de jours consécutifs (un stage de 3 jours = un seul).
  const runs: [string, string][] = input.kind === "entrainement" ? days.map((d) => [d, d]) : consecutiveRuns(days);
  let first: ReturnType<typeof clean> | null = null;
  for (const [start, end] of runs) {
    // L'heure n'a de sens que pour un seul jour : clean() l'écarte sinon.
    const e = clean({ ...input, startDate: start, endDate: end, time: days.length === 1 ? input.time : "" });
    first ??= e;
    await dbRun(
      `INSERT INTO calendar_events (id, athlete_id, author_id, updated_by, kind, title, start_date, end_date, time, location, notes, sport, duration_minutes, discipline, elevation_gain_m, route_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), athleteId, user.id, user.id, e.kind, e.title, e.start_date, e.end_date, e.time, e.location, e.notes, e.sport, e.duration_minutes, e.discipline, e.elevation_gain_m, e.route_url]
    );
  }
  // Une seule notification, même pour plusieurs dates.
  await notifyEventChange(user, athleteId, "added", first!, runs.length > 1 ? days : undefined);
  revalidateCalendars(athleteId, days);
}

export async function updateCalendarEventAction(id: string, input: CalendarEventInput) {
  const row = await getCalendarEvent(id);
  if (!row) throw new Error("Cet événement n'existe plus.");
  const user = await requireManager(row.athlete_id);
  // Plusieurs jours non consécutifs : l'événement garde la première suite de
  // jours, les suivantes deviennent de nouveaux événements identiques.
  const days = [...new Set((input.dates ?? []).filter((d) => DATE_RE.test(d)))].sort().slice(0, 366);
  const runs: [string, string][] = days.length ? (input.kind === "entrainement" ? days.map((d) => [d, d]) : consecutiveRuns(days)) : [];
  const e = clean(runs.length ? { ...input, startDate: runs[0][0], endDate: runs[0][1], time: days.length === 1 ? input.time : "" } : input);
  for (const [start, end] of runs.slice(1)) {
    const x = clean({ ...input, startDate: start, endDate: end, time: "" });
    await dbRun(
      `INSERT INTO calendar_events (id, athlete_id, author_id, updated_by, kind, title, start_date, end_date, time, location, notes, sport, duration_minutes, discipline, elevation_gain_m, route_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), row.athlete_id, user.id, user.id, x.kind, x.title, x.start_date, x.end_date, x.time, x.location, x.notes, x.sport, x.duration_minutes, x.discipline, x.elevation_gain_m, x.route_url]
    );
  }
  await dbRun(
    `UPDATE calendar_events SET kind = ?, title = ?, start_date = ?, end_date = ?, time = ?, location = ?, notes = ?, sport = ?, discipline = ?, duration_minutes = ?, elevation_gain_m = ?, route_url = ?,
       updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
    [e.kind, e.title, e.start_date, e.end_date, e.time, e.location, e.notes, e.sport, e.discipline, e.duration_minutes, e.elevation_gain_m, e.route_url, user.id, id]
  );
  await notifyEventChange(user, row.athlete_id, "updated", e);
  revalidateCalendars(row.athlete_id, [row.start_date, e.start_date, e.end_date, ...days]);
}

export async function deleteCalendarEventAction(id: string) {
  const row = await getCalendarEvent(id);
  if (!row) return;
  const user = await requireManager(row.athlete_id);
  await dbRun(`DELETE FROM calendar_events WHERE id = ?`, [id]);
  await notifyEventChange(user, row.athlete_id, "deleted", row);
  revalidateCalendars(row.athlete_id, [row.start_date]);
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

/** Déplacer un événement (athlète ou coach) : il garde sa durée. */
export async function moveCalendarEventAction(id: string, newStart: string) {
  if (!DATE_RE.test(newStart)) throw new Error("Date invalide.");
  const row = await dbGet<any>(`SELECT * FROM calendar_events WHERE id = ?`, [id]);
  if (!row) throw new Error("Cet événement n'existe plus.");
  const user = await requireManager(row.athlete_id);
  const newEnd = shiftDate(newStart, dayDiff(row.start_date, row.end_date));
  await dbRun(`UPDATE calendar_events SET start_date = ?, end_date = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`, [newStart, newEnd, user.id, id]);
  await notifyEventChange(user, row.athlete_id, "updated", { ...row, start_date: newStart, end_date: newEnd });
  revalidateCalendars(row.athlete_id, [row.start_date, newStart]);
}

/** Copier un événement sur d'autres jours (même durée à partir de chaque jour). */
export async function duplicateCalendarEventAction(id: string, dates: string[]) {
  const days = [...new Set(dates.filter((d) => DATE_RE.test(d)))].sort().slice(0, 60);
  if (!days.length) throw new Error("Choisissez au moins un jour.");
  const row = await dbGet<any>(`SELECT * FROM calendar_events WHERE id = ?`, [id]);
  if (!row) throw new Error("Cet événement n'existe plus.");
  const user = await requireManager(row.athlete_id);
  const len = dayDiff(row.start_date, row.end_date);
  for (const d of days) {
    await dbRun(
      `INSERT INTO calendar_events (id, athlete_id, author_id, updated_by, kind, title, start_date, end_date, time, location, notes, sport, duration_minutes, discipline, elevation_gain_m, route_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), row.athlete_id, user.id, user.id, row.kind, row.title, d, shiftDate(d, len), row.time, row.location, row.notes, row.sport, row.duration_minutes, row.discipline, row.elevation_gain_m, row.route_url]
    );
  }
  await notifyEventChange(user, row.athlete_id, "added", row, days.length > 1 ? days : undefined);
  revalidateCalendars(row.athlete_id, days);
}
