import { dbGet, dbAll } from "./db";
import type { Checkin } from "./checkin-types";

export interface AthleteLink {
  link_id: string;
  athlete_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string;
  invite_token: string | null;
  invite_email: string | null;
  avatar_path: string | null;
}

export async function getAthletesForCoach(coachId: string): Promise<AthleteLink[]> {
  return dbAll(
    `SELECT l.id as link_id, l.athlete_id, u.first_name, u.last_name, u.email, l.status, l.invite_token, l.invite_email, u.avatar_path
     FROM coach_athlete_links l
     LEFT JOIN users u ON u.id = l.athlete_id
     WHERE l.coach_id = ? AND l.status != 'revoked'
     ORDER BY l.created_at DESC`,
    [coachId]
  );
}

export interface CoachLink {
  link_id: string;
  coach_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export async function getCoachesForAthlete(athleteId: string): Promise<CoachLink[]> {
  return dbAll(
    `SELECT l.id as link_id, l.coach_id, u.first_name, u.last_name, u.email
     FROM coach_athlete_links l
     JOIN users u ON u.id = l.coach_id
     WHERE l.athlete_id = ? AND l.status = 'active'
     ORDER BY l.created_at DESC`,
    [athleteId]
  );
}

export interface Workout {
  id: string;
  coach_id: string;
  athlete_id: string;
  sport: string;
  category: string;
  priority: string | null;
  title: string;
  date: string;
  time: string | null;
  duration_minutes: number | null;
  description: string | null;
  color: string;
  status: string;
  rpe: number | null;
  athlete_feedback: string | null;
  actual_duration_minutes: number | null;
  coach_first_name?: string;
  coach_last_name?: string;
}

export async function getWorkoutsForAthlete(athleteId: string, fromDate?: string, toDate?: string): Promise<Workout[]> {
  if (fromDate && toDate) {
    return dbAll(
      `SELECT w.*, u.first_name as coach_first_name, u.last_name as coach_last_name
       FROM workouts w JOIN users u ON u.id = w.coach_id
       WHERE w.athlete_id = ? AND w.date BETWEEN ? AND ?
       ORDER BY w.date ASC, w.time ASC`,
      [athleteId, fromDate, toDate]
    );
  }
  return dbAll(
    `SELECT w.*, u.first_name as coach_first_name, u.last_name as coach_last_name
     FROM workouts w JOIN users u ON u.id = w.coach_id
     WHERE w.athlete_id = ?
     ORDER BY w.date ASC, w.time ASC`,
    [athleteId]
  );
}

export async function getWorkoutById(id: string): Promise<Workout | undefined> {
  return dbGet(
    `SELECT w.*, u.first_name as coach_first_name, u.last_name as coach_last_name
     FROM workouts w JOIN users u ON u.id = w.coach_id
     WHERE w.id = ?`,
    [id]
  );
}

export async function getBlocksForWorkout(workoutId: string) {
  const blocks = await dbAll<any>(
    `SELECT b.*, r.title as resource_title, r.type as resource_type, r.mime_type as resource_mime_type
     FROM workout_blocks b
     LEFT JOIN resources r ON r.id = b.resource_id
     WHERE b.workout_id = ? ORDER BY b.order_index ASC`,
    [workoutId]
  );

  const result = [];
  for (const b of blocks) {
    const exerciseSets = await dbAll(`SELECT * FROM exercise_sets WHERE block_id = ? ORDER BY order_index ASC`, [b.id]);
    result.push({ ...b, exerciseSets });
  }
  return result;
}

export async function getCommentsForWorkout(workoutId: string) {
  return dbAll(
    `SELECT c.*, u.first_name, u.last_name, u.role
     FROM workout_comments c JOIN users u ON u.id = c.author_id
     WHERE c.workout_id = ? ORDER BY c.created_at ASC`,
    [workoutId]
  );
}

export async function getMeasurementsForAthlete(athleteId: string) {
  return dbAll(`SELECT * FROM athlete_measurements WHERE athlete_id = ? ORDER BY recorded_at DESC`, [athleteId]);
}

export async function getLatestMeasurements(athleteId: string) {
  const rows = await getMeasurementsForAthlete(athleteId);
  const latest: Record<string, { value: number; recorded_at: string }> = {};
  for (const row of rows as any[]) {
    if (!latest[row.metric]) latest[row.metric] = { value: row.value, recorded_at: row.recorded_at };
  }
  return latest;
}

export async function getInjuriesForAthlete(athleteId: string) {
  return dbAll(`SELECT * FROM injuries WHERE athlete_id = ? ORDER BY date_start DESC`, [athleteId]);
}

export async function getJournalForAthlete(athleteId: string) {
  return dbAll(`SELECT * FROM journal_entries WHERE athlete_id = ? ORDER BY entry_date DESC`, [athleteId]);
}

export async function profileCompletion(athleteId: string): Promise<number> {
  // Onboarding progressif (cf. prompt) : indicateur de complétion plutôt qu'un
  // formulaire bloquant à l'inscription.
  const latest = await getLatestMeasurements(athleteId);
  const journal = await getJournalForAthlete(athleteId);
  const fields = ["weight_kg", "height_cm", "fc_repos", "fc_max", "vo2max"];
  const filled = fields.filter((f) => latest[f]).length;
  let score = (filled / fields.length) * 80; // 80% pour les mesures
  if (journal.length > 0) score += 20; // 20% pour avoir amorcé le journal de bord
  return Math.round(Math.min(100, score));
}

// --- Connexions externes & activités importées (cf. résilience Garmin/Strava) ---

export interface ExternalConnection {
  provider: "garmin" | "strava";
  status: "disconnected" | "connected" | "error";
  last_sync_at: string | null;
  last_error: string | null;
}

export async function getExternalConnections(athleteId: string): Promise<ExternalConnection[]> {
  const providers: ("garmin" | "strava")[] = ["garmin", "strava"];
  const rows = await dbAll<any>(`SELECT * FROM external_connections WHERE athlete_id = ?`, [athleteId]);
  return providers.map(
    (p) =>
      rows.find((r) => r.provider === p) || {
        provider: p,
        status: "disconnected",
        last_sync_at: null,
        last_error: null,
      }
  );
}

export interface ImportedActivity {
  id: string;
  athlete_id: string;
  workout_id: string | null;
  source: "manual" | "garmin" | "strava";
  activity_date: string;
  activity_time: string | null;
  sport: string;
  duration_minutes: number | null;
  distance_km: number | null;
  avg_hr: number | null;
  notes: string | null;
}

export async function getImportedActivities(athleteId: string, limit = 15): Promise<ImportedActivity[]> {
  return dbAll(
    `SELECT * FROM imported_activities WHERE athlete_id = ? ORDER BY activity_date DESC, activity_time DESC LIMIT ?`,
    [athleteId, limit]
  );
}

// Utilisée par le calendrier (jour précis ou semaine) côté athlète et par la
// fiche athlète côté coach — les imports manuels/synchronisés n'apparaissaient
// nulle part ailleurs que la page de profil jusqu'ici.
export async function getImportedActivitiesForRange(
  athleteId: string,
  fromDate: string,
  toDate: string
): Promise<ImportedActivity[]> {
  return dbAll(
    `SELECT * FROM imported_activities WHERE athlete_id = ? AND activity_date BETWEEN ? AND ?
     ORDER BY activity_date ASC, activity_time ASC`,
    [athleteId, fromDate, toDate]
  );
}

// --- Bibliothèque de ressources du coach (vidéos, photos, matériel) ---

export interface Resource {
  id: string;
  coach_id: string;
  type: "video" | "photo" | "equipment";
  title: string;
  description: string | null;
  sport: string | null;
  file_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export async function getResourcesForCoach(coachId: string, type?: string): Promise<Resource[]> {
  if (type) {
    return dbAll(`SELECT * FROM resources WHERE coach_id = ? AND type = ? ORDER BY created_at DESC`, [coachId, type]);
  }
  return dbAll(`SELECT * FROM resources WHERE coach_id = ? ORDER BY created_at DESC`, [coachId]);
}

export async function getResourceById(id: string): Promise<Resource | undefined> {
  return dbGet(`SELECT * FROM resources WHERE id = ?`, [id]);
}

// Exercices déjà utilisés par ce coach, du plus fréquent au moins fréquent — mis en
// avant dans l'autocomplétion du constructeur musculation (cf. V2.2), avant la liste
// générique d'exercices courants.
export async function getCoachExerciseHistory(coachId: string, limit = 30): Promise<string[]> {
  const rows = await dbAll<any>(
    `SELECT b.exercise_name, COUNT(*) as freq
     FROM workout_blocks b
     JOIN workouts w ON w.id = b.workout_id
     WHERE w.coach_id = ?
     GROUP BY b.exercise_name
     ORDER BY freq DESC
     LIMIT ?`,
    [coachId, limit]
  );
  return rows.map((r) => r.exercise_name);
}

export async function getSetsForBlock(blockId: string) {
  return dbAll(`SELECT * FROM exercise_sets WHERE block_id = ? ORDER BY order_index ASC`, [blockId]);
}

// --- Objectifs et événements à venir (cf. V3 : décompte façon préparateur physique) ---
// Priorité A/B/C : convention standard en préparation physique (popularisée par
// TrainingPeaks/Joe Friel) pour distinguer l'objectif principal de la saison (A) des
// objectifs secondaires (B) et sorties de calage (C), afin de planifier l'affûtage
// autour de la bonne échéance plutôt que de traiter tous les objectifs à égalité.
export async function getUpcomingGoals(athleteId: string, limit = 5) {
  return dbAll(
    `SELECT * FROM workouts
     WHERE athlete_id = ? AND category IN ('objectif','evenement') AND date >= date('now')
     ORDER BY date ASC LIMIT ?`,
    [athleteId, limit]
  );
}

// --- Photo de profil ---

export async function getUserAvatar(
  userId: string
): Promise<{ avatar_path: string | null; avatar_mime_type: string | null; first_name: string } | undefined> {
  return dbGet(`SELECT avatar_path, avatar_mime_type, first_name FROM users WHERE id = ?`, [userId]);
}

// --- Messagerie coach <-> athlète ---

export async function getMessages(coachId: string, athleteId: string, limit = 100) {
  return dbAll(
    `SELECT m.*, u.first_name, u.last_name FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.coach_id = ? AND m.athlete_id = ?
     ORDER BY m.created_at ASC LIMIT ?`,
    [coachId, athleteId, limit]
  );
}

export async function getUnreadMessageCount(coachId: string, athleteId: string, forUserId: string): Promise<number> {
  const row = await dbGet<any>(
    `SELECT COUNT(*) as count FROM messages
     WHERE coach_id = ? AND athlete_id = ? AND sender_id != ? AND read_at IS NULL`,
    [coachId, athleteId, forUserId]
  );
  return row?.count ?? 0;
}

// --- Check-in quotidien de forme ---

export async function getUserGender(userId: string): Promise<string | null> {
  const row = await dbGet<any>(`SELECT gender FROM users WHERE id = ?`, [userId]);
  return row?.gender ?? null;
}

export async function getCheckinForDate(athleteId: string, date: string): Promise<Checkin | undefined> {
  return dbGet(`SELECT * FROM daily_checkins WHERE athlete_id = ? AND check_date = ?`, [athleteId, date]);
}

export async function getRecentCheckins(athleteId: string, limit = 7): Promise<Checkin[]> {
  return dbAll(`SELECT * FROM daily_checkins WHERE athlete_id = ? ORDER BY check_date DESC LIMIT ?`, [
    athleteId,
    limit,
  ]);
}
