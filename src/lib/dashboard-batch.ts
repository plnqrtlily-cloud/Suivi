import { dbAll } from "./db";
import type { Workout } from "./queries";
import type { Checkin } from "./checkin-types";

// Le tableau de bord affichait une ligne par athlète en faisant 8 requêtes
// CHACUN : instantané à 3 athlètes, plusieurs secondes et un risque de
// saturation des connexions à 30. Ici, une poignée de requêtes couvrent tout
// l'effectif d'un coup, avec un regroupement en mémoire côté serveur.
//
// Les identifiants sont injectés via des paramètres liés (un ? par athlète)
// plutôt que concaténés dans la requête.
function placeholders(n: number): string {
  return Array(n).fill("?").join(", ");
}

export interface DashboardBatch {
  workoutsByAthlete: Map<string, Workout[]>;
  checkinByAthlete: Map<string, Checkin>;
  unreadByAthlete: Map<string, number>;
  journalByAthlete: Map<string, string>;
  acwrWorkoutsByAthlete: Map<string, Workout[]>;
  importsByAthlete: Map<string, { activity_date: string; duration_minutes: number | null; rpe: number | null }[]>;
  lastWorkoutsByAthlete: Map<string, Workout[]>;
}

export async function loadDashboardBatch(
  coachId: string,
  athleteIds: string[],
  today: string,
  acwrFrom: string,
  recentFrom: string
): Promise<DashboardBatch> {
  const empty: DashboardBatch = {
    workoutsByAthlete: new Map(),
    checkinByAthlete: new Map(),
    unreadByAthlete: new Map(),
    journalByAthlete: new Map(),
    acwrWorkoutsByAthlete: new Map(),
    importsByAthlete: new Map(),
    lastWorkoutsByAthlete: new Map(),
  };
  if (athleteIds.length === 0) return empty;

  const ph = placeholders(athleteIds.length);

  const [todayWorkouts, checkins, unread, journal, acwrWorkouts, imports, recentWorkouts] = await Promise.all([
    // Séances du jour
    dbAll<any>(
      `SELECT * FROM workouts WHERE athlete_id IN (${ph}) AND date = ? AND is_draft = 0 ORDER BY time ASC`,
      [...athleteIds, today]
    ),
    // Dernier check-in de chaque athlète
    dbAll<any>(
      `SELECT c.* FROM daily_checkins c
       WHERE c.athlete_id IN (${ph})
         AND c.check_date = (SELECT MAX(check_date) FROM daily_checkins WHERE athlete_id = c.athlete_id)`,
      athleteIds
    ),
    // Messages non lus, comptés par athlète
    dbAll<any>(
      `SELECT athlete_id, COUNT(*) as count FROM messages
       WHERE coach_id = ? AND athlete_id IN (${ph}) AND sender_id != ? AND read_at IS NULL
       GROUP BY athlete_id`,
      [coachId, ...athleteIds, coachId]
    ),
    // Note de journal du jour
    dbAll<any>(`SELECT athlete_id, content FROM journal_entries WHERE athlete_id IN (${ph}) AND entry_date = ?`, [
      ...athleteIds,
      today,
    ]),
    // Séances de la fenêtre ACWR (28 jours)
    dbAll<any>(
      `SELECT * FROM workouts WHERE athlete_id IN (${ph}) AND date BETWEEN ? AND ? AND is_draft = 0`,
      [...athleteIds, acwrFrom, today]
    ),
    // Activités importées de la même fenêtre
    dbAll<any>(
      `SELECT athlete_id, activity_date, duration_minutes, rpe FROM imported_activities
       WHERE athlete_id IN (${ph}) AND activity_date BETWEEN ? AND ?`,
      [...athleteIds, acwrFrom, today]
    ),
    // Séances récentes et à venir, pour les signaux (séances ratées, sans
    // retour, prochaine séance prévue)
    dbAll<any>(
      `SELECT * FROM workouts WHERE athlete_id IN (${ph}) AND date >= ? AND is_draft = 0 ORDER BY date ASC`,
      [...athleteIds, recentFrom]
    ),
  ]);

  function groupBy<T extends { athlete_id: string }>(rows: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const list = map.get(row.athlete_id);
      if (list) list.push(row);
      else map.set(row.athlete_id, [row]);
    }
    return map;
  }

  return {
    workoutsByAthlete: groupBy(todayWorkouts),
    checkinByAthlete: new Map(checkins.map((c) => [c.athlete_id, c])),
    unreadByAthlete: new Map(unread.map((u) => [u.athlete_id, Number(u.count)])),
    journalByAthlete: new Map(journal.map((j) => [j.athlete_id, j.content])),
    acwrWorkoutsByAthlete: groupBy(acwrWorkouts),
    importsByAthlete: groupBy(imports),
    lastWorkoutsByAthlete: groupBy(recentWorkouts),
  };
}
