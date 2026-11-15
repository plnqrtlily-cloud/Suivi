// Événements du calendrier partagé athlète ↔ coachs (compétition, stage,
// rendez-vous…). Chacun peut en ajouter, modifier ou supprimer sur le
// calendrier de l'athlète ; les autres personnes concernées sont notifiées
// (in-app + push). Lecture côté serveur uniquement.
import { dbAll, dbGet } from "./db";
import { isCoachLinkedToAthlete, type User } from "./auth";
import { createNotification } from "./notifications";
import { eventDateLabel, eventKind, type CalendarEventView, type EventKind } from "./calendar-event-kinds";

interface EventRow {
  id: string;
  athlete_id: string;
  author_id: string | null;
  kind: string;
  title: string;
  start_date: string;
  end_date: string;
  time: string | null;
  location: string | null;
  notes: string | null;
  sport: string | null;
  duration_minutes: number | null;
  author_first_name: string | null;
}

function toView(r: EventRow, viewerId: string): CalendarEventView {
  return {
    id: r.id,
    athleteId: r.athlete_id,
    kind: eventKind(r.kind).value as EventKind,
    title: r.title,
    startDate: r.start_date,
    endDate: r.end_date,
    time: r.time,
    location: r.location,
    notes: r.notes,
    sport: r.sport,
    durationMinutes: r.duration_minutes,
    authorName: r.author_first_name || "?",
    mine: r.author_id === viewerId,
  };
}

/** Événements de ces athlètes qui chevauchent [from, to]. */
export async function getCalendarEvents(athleteIds: string[], from: string, to: string, viewerId: string): Promise<CalendarEventView[]> {
  if (!athleteIds.length) return [];
  const rows = await dbAll<EventRow>(
    `SELECT e.id, e.athlete_id, e.author_id, e.kind, e.title, e.start_date, e.end_date, e.time, e.location, e.notes, e.sport, e.duration_minutes,
            u.first_name AS author_first_name
     FROM calendar_events e LEFT JOIN users u ON u.id = e.author_id
     WHERE e.athlete_id IN (${athleteIds.map(() => "?").join(",")}) AND e.start_date <= ? AND e.end_date >= ?
     ORDER BY e.start_date ASC, COALESCE(e.time, '') ASC`,
    [...athleteIds, to, from]
  );
  return rows.map((r) => toView(r, viewerId));
}

export async function getCalendarEvent(id: string) {
  return dbGet<{ id: string; athlete_id: string; title: string; kind: string; start_date: string; end_date: string }>(
    `SELECT id, athlete_id, title, kind, start_date, end_date FROM calendar_events WHERE id = ?`,
    [id]
  );
}

/** L'athlète lui-même, ou un coach qui le suit. */
export async function canManageAthleteCalendar(user: User, athleteId: string): Promise<boolean> {
  if (user.role === "athlete") return user.id === athleteId;
  return user.role === "coach" && (await isCoachLinkedToAthlete(user.id, athleteId));
}

export type EventChange = "added" | "updated" | "deleted";

/**
 * Prévient tous ceux qui partagent ce calendrier, sauf l'auteur de la
 * modification : l'athlète si c'est un coach qui a agi, ses coachs actifs
 * dans tous les cas.
 */
export async function notifyEventChange(
  actor: User,
  athleteId: string,
  change: EventChange,
  e: { title: string; kind: string; start_date: string; end_date: string },
  /** Plusieurs dates séparées créées d'un coup : résumées dans une seule notification. */
  scattered?: string[]
) {
  const coaches = await dbAll<{ coach_id: string }>(
    `SELECT coach_id FROM coach_athlete_links WHERE athlete_id = ? AND status = 'active'`,
    [athleteId]
  );
  const athlete = await dbGet<{ first_name: string }>(`SELECT first_name FROM users WHERE id = ?`, [athleteId]);
  const training = e.kind === "entrainement";
  const what1 = scattered ? (training ? "des entraînements" : "des événements") : training ? "un entraînement" : "un événement";
  const verb = change === "added" ? "a ajouté" : change === "updated" ? "a modifié" : "a supprimé";
  const when = scattered ? `${scattered.length} jours dès le ${eventDateLabel(scattered[0], scattered[0])}` : eventDateLabel(e.start_date, e.end_date);
  const what = `${eventKind(e.kind).label} · ${e.title} · ${when}`;
  const month = e.start_date.slice(0, 7);
  const recipients: { id: string; link: string; title: string }[] = [];

  if (actor.id !== athleteId) {
    recipients.push({
      id: athleteId,
      link: `/athlete/programmation?view=month&month=${month}&day=${e.start_date}`,
      title: `${actor.first_name} ${verb} ${what1} à ton calendrier`,
    });
  }
  for (const c of coaches) {
    if (c.coach_id === actor.id) continue;
    recipients.push({
      id: c.coach_id,
      link: `/coach/athletes/${athleteId}?view=month&month=${month}`,
      title:
        actor.id === athleteId
          ? `${actor.first_name} ${verb} ${what1} à son calendrier`
          : `${actor.first_name} ${verb} ${what1} au calendrier de ${athlete?.first_name ?? "votre athlète"}`,
    });
  }
  await Promise.all(
    recipients.map((r) => createNotification({ userId: r.id, type: "event_reminder", title: r.title, body: what, link: r.link }))
  );
}
