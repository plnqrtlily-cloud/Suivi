"use server";

import { randomUUID } from "crypto";
import { revalidatePath as nextRevalidatePath, refresh } from "next/cache";
import { getCurrentUser } from "./auth";
import { dbRun } from "./db";
import { EVENT_KINDS } from "./calendar-event-kinds";
import { canManageAthleteCalendar, getCalendarEvent, notifyEventChange } from "./calendar-events";

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
  time?: string;
  location?: string;
  notes?: string;
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
  const e = clean(input);
  await dbRun(
    `INSERT INTO calendar_events (id, athlete_id, author_id, updated_by, kind, title, start_date, end_date, time, location, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), athleteId, user.id, user.id, e.kind, e.title, e.start_date, e.end_date, e.time, e.location, e.notes]
  );
  await notifyEventChange(user, athleteId, "added", e);
  revalidateCalendars(athleteId, [e.start_date, e.end_date]);
}

export async function updateCalendarEventAction(id: string, input: CalendarEventInput) {
  const row = await getCalendarEvent(id);
  if (!row) throw new Error("Cet événement n'existe plus.");
  const user = await requireManager(row.athlete_id);
  const e = clean(input);
  await dbRun(
    `UPDATE calendar_events SET kind = ?, title = ?, start_date = ?, end_date = ?, time = ?, location = ?, notes = ?,
       updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
    [e.kind, e.title, e.start_date, e.end_date, e.time, e.location, e.notes, user.id, id]
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
