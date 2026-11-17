"use server";

import { parseDiscipline } from "./mtb";
import { randomUUID } from "crypto";
import { revalidatePath as nextRevalidatePath, refresh } from "next/cache";
import { getCurrentUser } from "./auth";
import { dbRun } from "./db";
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
    discipline: kind === "entrainement" && input.sport === "mtb" ? (parseDiscipline(input.discipline) ?? "mtb") : null,
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
      `INSERT INTO calendar_events (id, athlete_id, author_id, updated_by, kind, title, start_date, end_date, time, location, notes, sport, duration_minutes, discipline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), athleteId, user.id, user.id, e.kind, e.title, e.start_date, e.end_date, e.time, e.location, e.notes, e.sport, e.duration_minutes, e.discipline]
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
  const e = clean(input);
  await dbRun(
    `UPDATE calendar_events SET kind = ?, title = ?, start_date = ?, end_date = ?, time = ?, location = ?, notes = ?, sport = ?, discipline = ?, duration_minutes = ?,
       updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
    [e.kind, e.title, e.start_date, e.end_date, e.time, e.location, e.notes, e.sport, e.discipline, e.duration_minutes, user.id, id]
  );
  await notifyEventChange(user, row.athlete_id, "updated", e);
  revalidateCalendars(row.athlete_id, [row.start_date, e.start_date, e.end_date]);
}

export async function deleteCalendarEventAction(id: string) {
  const row = await getCalendarEvent(id);
  if (!row) return;
  const user = await requireManager(row.athlete_id);
  await dbRun(`DELETE FROM calendar_events WHERE id = ?`, [id]);
  await notifyEventChange(user, row.athlete_id, "deleted", row);
  revalidateCalendars(row.athlete_id, [row.start_date]);
}
