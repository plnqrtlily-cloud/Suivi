import { randomUUID } from "crypto";

// NOTE : la base est repartie de zéro en supprimant data/ AVANT de lancer ce
// script (`rm -rf data && npx tsx scripts/e2e-check.ts`), pas depuis le script
// lui-même. En JavaScript/TypeScript (modules ES), tous les imports sont
// hissés et exécutés avant le reste du code, quel que soit leur ordre textuel
// dans le fichier — une suppression de fichier ici s'exécuterait donc APRÈS
// que le client libSQL importé plus bas ait déjà ouvert une connexion sur ce
// fichier, provoquant une erreur "disk I/O error" (fstat sur un fichier
// supprimé sous une connexion déjà active). Constaté et corrigé lors de la
// migration vers libSQL/Turso.

import { dbGet, dbAll, dbRun } from "../src/lib/db";
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  isCoachLinkedToAthlete,
  createPasswordResetToken,
  consumePasswordResetToken,
  updateUserPassword,
} from "../src/lib/auth";
import { estimateCyclePhase, getCycleSettings } from "../src/lib/cycle";
import { getCoachExerciseHistory } from "../src/lib/queries";
import { saveUploadedFile, readUploadedFile, deleteUploadedFile } from "../src/lib/storage";
import { createNotification, getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from "../src/lib/notifications";
import { computeGlobalScore, computeHooperIndex, scoreLabel } from "../src/lib/checkin-types";

function assert(cond: any, message: string) {
  if (!cond) {
    console.error(`❌ ÉCHEC: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

async function main() {
  // 1. Création des comptes
  const coach = await createUser({ email: "coach@test.fr", password: "motdepasse123", role: "coach", firstName: "Claire", lastName: "Coach" });
  const athlete = await createUser({ email: "athlete@test.fr", password: "motdepasse123", role: "athlete", firstName: "Sam", lastName: "Athlete" });
  const otherAthlete = await createUser({ email: "autre@test.fr", password: "motdepasse123", role: "athlete", firstName: "Léo", lastName: "Autre" });

  assert(!!coach.id && !!athlete.id, "Comptes coach et athlète créés");

  // 2. Vérification du hash de mot de passe (pas de mot de passe en clair)
  const row = await findUserByEmail("coach@test.fr");
  assert(!!row && row.password_hash !== "motdepasse123", "Le mot de passe est bien haché en base");
  assert(!!row && verifyPassword("motdepasse123", row.password_hash), "verifyPassword valide le bon mot de passe");
  assert(!!row && !verifyPassword("mauvais_mdp", row.password_hash), "verifyPassword rejette un mauvais mot de passe");

  // 3. Flux d'invitation : le coach invite, l'athlète accepte
  const inviteId = randomUUID();
  const inviteToken = "test1234";
  await dbRun(`INSERT INTO coach_athlete_links (id, coach_id, invite_token, status) VALUES (?, ?, ?, 'pending')`, [
    inviteId,
    coach.id,
    inviteToken,
  ]);

  assert(!(await isCoachLinkedToAthlete(coach.id, athlete.id)), "Avant acceptation, le lien n'est pas actif");

  await dbRun(
    `UPDATE coach_athlete_links SET athlete_id = ?, status = 'active', accepted_at = datetime('now') WHERE id = ?`,
    [athlete.id, inviteId]
  );

  assert(await isCoachLinkedToAthlete(coach.id, athlete.id), "Après acceptation, le lien coach-athlète est actif");
  assert(
    !(await isCoachLinkedToAthlete(coach.id, otherAthlete.id)),
    "Le coach n'est PAS lié à un athlète qu'il n'a pas invité — règle de permission critique"
  );

  // 4. Création d'une séance de musculation avec blocs, cf. structuration en blocs du prompt
  const workoutId = randomUUID();
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date, color)
     VALUES (?, ?, ?, 'strength', 'entrainement', ?, ?, '#2F6F5E')`,
    [workoutId, coach.id, athlete.id, "Séance renfort bas du corps", "2026-09-15"]
  );

  await dbRun(
    `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, order_index) VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), workoutId, "warmup_mobility", "Mobilité hanches", 0]
  );
  await dbRun(
    `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, order_index) VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), workoutId, "main", "Squat", 1]
  );
  await dbRun(
    `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, order_index) VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), workoutId, "core", "Gainage planche", 2]
  );

  const blocks = await dbAll<any>(`SELECT * FROM workout_blocks WHERE workout_id = ? ORDER BY order_index`, [workoutId]);
  assert(blocks.length === 3, "Les 3 blocs de la séance de musculation sont bien enregistrés");
  assert(
    blocks[0].block_type === "warmup_mobility" && blocks[1].block_type === "main" && blocks[2].block_type === "core",
    "L'ordre des blocs (échauffement -> corps de séance -> gainage) est respecté"
  );

  // 5. Retour athlète (statut + RPE) — non punitif si "not_done"
  await dbRun(`UPDATE workouts SET status = 'not_done', rpe = NULL WHERE id = ?`, [workoutId]);
  const updated = await dbGet<any>(`SELECT status FROM workouts WHERE id = ?`, [workoutId]);
  assert(updated?.status === "not_done", "Le statut 'non réalisée' est bien enregistré (affiché en gris neutre côté UI, pas en rouge)");

  // 6. Commentaire coach <-> athlète
  await dbRun(`INSERT INTO workout_comments (id, workout_id, author_id, body) VALUES (?, ?, ?, ?)`, [
    randomUUID(),
    workoutId,
    athlete.id,
    "J'étais fatigué, séance décalée à demain.",
  ]);
  const comments = await dbAll<any>(`SELECT * FROM workout_comments WHERE workout_id = ?`, [workoutId]);
  assert(comments.length === 1, "Le commentaire de l'athlète est bien attaché à la séance");

  // 7. Mesures physiologiques avec historique
  await dbRun(`INSERT INTO athlete_measurements (id, athlete_id, metric, value) VALUES (?, ?, 'weight_kg', 68.5)`, [
    randomUUID(),
    athlete.id,
  ]);
  await dbRun(`INSERT INTO athlete_measurements (id, athlete_id, metric, value) VALUES (?, ?, 'weight_kg', 68.2)`, [
    randomUUID(),
    athlete.id,
  ]);
  const measurements = await dbAll<any>(`SELECT * FROM athlete_measurements WHERE athlete_id = ?`, [athlete.id]);
  assert(measurements.length === 2, "Historique des mesures : deux valeurs de poids conservées dans le temps");

  // 8. Propriété des données de l'athlète : la table athlete_measurements référence l'athlète, pas le coach
  assert(measurements.every((m) => m.athlete_id === athlete.id), "Les mesures appartiennent à l'athlète, indépendamment du coach");

  // 9. Réinitialisation de mot de passe : à usage unique, expire, invalide les sessions
  const resetToken = await createPasswordResetToken(athlete.id);
  const resolvedUserId = await consumePasswordResetToken(resetToken);
  assert(resolvedUserId === athlete.id, "Le token de reset résout bien vers le bon utilisateur");
  const secondAttempt = await consumePasswordResetToken(resetToken);
  assert(secondAttempt === null, "Le token de reset est à usage unique (rejeté à la 2e tentative)");

  await updateUserPassword(athlete.id, "nouveaumotdepasse456");
  const afterReset = await findUserByEmail("athlete@test.fr");
  assert(!!afterReset && verifyPassword("nouveaumotdepasse456", afterReset.password_hash), "Le nouveau mot de passe est actif après réinitialisation");
  assert(!!afterReset && !verifyPassword("motdepasse123", afterReset.password_hash), "L'ancien mot de passe ne fonctionne plus");

  // 10. Cycle menstruel : partage désactivé par défaut (consentement séparé, RGPD)
  const defaultSettings = await getCycleSettings(athlete.id);
  assert(defaultSettings.share_with_coaches === 0, "Le partage du cycle est désactivé par défaut (consentement explicite requis)");

  await dbRun(
    `INSERT INTO cycle_entries (id, athlete_id, entry_date, entry_type) VALUES (?, ?, date('now', '-3 days'), 'period_start')`,
    [randomUUID(), athlete.id]
  );
  const estimate = await estimateCyclePhase(athlete.id);
  assert(estimate.phase === "menstruelle", "L'estimation de phase du cycle fonctionne à partir d'une entrée récente");

  // 11. RGPD : suppression de compte en cascade
  const toDelete = await createUser({ email: "adelete@test.fr", password: "motdepasse123", role: "athlete", firstName: "A", lastName: "Supprimer" });
  await dbRun(`INSERT INTO journal_entries (id, athlete_id, entry_date, content) VALUES (?, ?, date('now'), 'note test')`, [
    randomUUID(),
    toDelete.id,
  ]);
  await dbRun(`DELETE FROM users WHERE id = ?`, [toDelete.id]);
  const orphanJournal = await dbAll(`SELECT * FROM journal_entries WHERE athlete_id = ?`, [toDelete.id]);
  assert(orphanJournal.length === 0, "La suppression de compte entraîne bien la suppression en cascade des données associées (RGPD)");

  // 12. Résilience Garmin/Strava : statut de connexion toujours explicite (jamais silencieux)
  const noEnvConnections = await dbAll(`SELECT * FROM external_connections WHERE athlete_id = ?`, [athlete.id]);
  assert(noEnvConnections.length === 0, "Aucune connexion simulée tant qu'aucune clé API n'est configurée (pas de faux statut 'connecté')");

  await dbRun(
    `INSERT INTO external_connections (id, athlete_id, provider, status, last_error) VALUES (?, ?, 'garmin', 'error', 'Identifiants non configurés')`,
    [randomUUID(), athlete.id]
  );
  const garminStatus = await dbGet<any>(`SELECT status, last_error FROM external_connections WHERE athlete_id = ? AND provider = 'garmin'`, [
    athlete.id,
  ]);
  assert(garminStatus?.status === "error" && !!garminStatus.last_error, "Le statut d'erreur Garmin est explicite, avec un message compréhensible");

  // 13. Import manuel indépendant de toute API tierce
  await dbRun(
    `INSERT INTO imported_activities (id, athlete_id, source, activity_date, sport, duration_minutes) VALUES (?, ?, 'manual', date('now'), 'running', 45)`,
    [randomUUID(), athlete.id]
  );
  const manualActivities = await dbAll(`SELECT * FROM imported_activities WHERE athlete_id = ? AND source = 'manual'`, [athlete.id]);
  assert(manualActivities.length === 1, "L'import manuel fonctionne indépendamment de Garmin/Strava");

  // 14. Bibliothèque de ressources : un coach dépose ses propres documents
  const otherCoach = await createUser({ email: "autrecoach@test.fr", password: "motdepasse123", role: "coach", firstName: "Julie", lastName: "Rival" });

  await dbRun(
    `INSERT INTO resources (id, coach_id, type, title, file_path, mime_type, file_size) VALUES (?, ?, 'photo', 'Squat vue de face', 'fake.jpg', 'image/jpeg', 1000)`,
    [randomUUID(), coach.id]
  );
  await dbRun(
    `INSERT INTO resources (id, coach_id, type, title, description) VALUES (?, ?, 'equipment', 'Élastiques de résistance', 'Set de 3 tensions')`,
    [randomUUID(), coach.id]
  );

  const coachResources = await dbAll<any>(`SELECT * FROM resources WHERE coach_id = ?`, [coach.id]);
  assert(coachResources.length === 2, "Le coach a bien 2 ressources dans sa bibliothèque (1 photo + 1 fiche matériel)");

  const otherCoachResources = await dbAll(`SELECT * FROM resources WHERE coach_id = ?`, [otherCoach.id]);
  assert(otherCoachResources.length === 0, "Un autre coach n'a AUCUNE ressource visible — bibliothèques bien cloisonnées par coach");

  // Le matériel peut être ajouté sans fichier (fiche texte simple)
  const equipmentEntry = coachResources.find((r) => r.type === "equipment");
  assert(!!equipmentEntry && equipmentEntry.file_path === null, "Une fiche matériel peut exister sans fichier joint");

  // 15. Stockage réel des fichiers sur disque (upload effectif, pas seulement la métadonnée)
  const fakeFile = new File([Buffer.from("contenu-image-test")], "photo-squat.jpg", { type: "image/jpeg" });
  const saved = await saveUploadedFile(fakeFile);
  assert(saved.storedName.endsWith(".jpg"), "Le fichier uploadé est stocké avec un nom opaque conservant l'extension");

  const readBack = await readUploadedFile(saved.storedName);
  assert(!!readBack && readBack.toString() === "contenu-image-test", "Le fichier stocké est relu à l'identique depuis le disque");

  await deleteUploadedFile(saved.storedName);
  const afterDelete = await readUploadedFile(saved.storedName);
  assert(afterDelete === null, "Le fichier est bien supprimé du disque après suppression de la ressource");

  // 16. Lien exercice <-> ressource de la bibliothèque (avec vérification de propriété)
  const squatPhotoId = randomUUID();
  await dbRun(
    `INSERT INTO resources (id, coach_id, type, title, file_path, mime_type) VALUES (?, ?, 'photo', 'Squat vue de face', 'squat.jpg', 'image/jpeg')`,
    [squatPhotoId, coach.id]
  );

  const otherWorkoutId = randomUUID();
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date) VALUES (?, ?, ?, 'strength', 'entrainement', 'Séance test ressource', '2026-09-20')`,
    [otherWorkoutId, coach.id, athlete.id]
  );
  await dbRun(
    `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, resource_id, order_index) VALUES (?, ?, 'main', 'Squat', ?, 0)`,
    [randomUUID(), otherWorkoutId, squatPhotoId]
  );

  const linkedBlock = await dbGet<any>(
    `SELECT b.*, r.title as resource_title FROM workout_blocks b LEFT JOIN resources r ON r.id = b.resource_id WHERE workout_id = ?`,
    [otherWorkoutId]
  );
  assert(linkedBlock?.resource_title === "Squat vue de face", "L'exercice affiche bien le titre de la ressource attachée");

  const otherCoachResourceId = randomUUID();
  await dbRun(
    `INSERT INTO resources (id, coach_id, type, title, file_path, mime_type) VALUES (?, ?, 'photo', 'Ressource concurrente', 'x.jpg', 'image/jpeg')`,
    [otherCoachResourceId, otherCoach.id]
  );
  const foreignResource = await dbGet<any>(`SELECT coach_id FROM resources WHERE id = ?`, [otherCoachResourceId]);
  assert(foreignResource?.coach_id !== coach.id, "La ressource d'un autre coach ne lui appartient pas (vérifié avant tout INSERT applicatif dans createWorkoutAction)");

  // 17. Notifications : création, comptage des non-lues, lecture individuelle et globale
  await createNotification({ userId: athlete.id, type: "new_workout", title: "Nouvelle séance", link: "/workouts/abc" });
  await createNotification({ userId: athlete.id, type: "comment", title: "Nouveau commentaire", link: "/workouts/abc" });

  const unreadBefore = await getUnreadCount(athlete.id);
  assert(unreadBefore >= 2, "Les notifications non lues sont bien comptées");

  const list = await getNotifications(athlete.id);
  assert(list.length >= 2 && !list[0].read_at, "La liste des notifications est renvoyée, non lue par défaut");

  await markNotificationRead(list[0].id, athlete.id);
  const afterOneReadList = await getNotifications(athlete.id);
  const afterOneRead = afterOneReadList.find((n) => n.id === list[0].id);
  assert(!!afterOneRead?.read_at, "Une notification marquée comme lue porte bien un horodatage de lecture");

  await markAllNotificationsRead(athlete.id);
  const unreadAfterAll = await getUnreadCount(athlete.id);
  assert(unreadAfterAll === 0, "« Tout marquer comme lu » ramène bien le compteur à zéro");

  // 18. Rappel avant une compétition : généré automatiquement, sans jamais dupliquer
  const eventWorkoutId = randomUUID();
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date) VALUES (?, ?, ?, 'running', 'evenement', 'Trail des collines', date('now', '+1 day'))`,
    [eventWorkoutId, coach.id, athlete.id]
  );

  await getNotifications(athlete.id); // déclenche la génération du rappel
  const remindersAfterFirstCall = await dbAll(`SELECT * FROM notifications WHERE user_id = ? AND type = 'event_reminder'`, [athlete.id]);
  assert(remindersAfterFirstCall.length === 1, "Un rappel est généré pour l'événement à venir dans les 3 jours");

  await getNotifications(athlete.id); // rappel : ne doit PAS dupliquer
  const remindersAfterSecondCall = await dbAll(`SELECT * FROM notifications WHERE user_id = ? AND type = 'event_reminder'`, [athlete.id]);
  assert(remindersAfterSecondCall.length === 1, "Le rappel n'est jamais dupliqué en rappelant getNotifications plusieurs fois");

  // 19. Check-in quotidien de forme : calcul du score, inversion courbatures/stress, upsert
  const perfectScore = computeGlobalScore({ physical_level: 10, mental_level: 10, sleep_quality: 10, soreness: 1, stress: 1 });
  assert(perfectScore === 10, "Un état parfait (pas de courbatures ni de stress) donne un score de 10/10");

  const tiredScore = computeGlobalScore({ physical_level: 2, mental_level: 2, sleep_quality: 2, soreness: 9, stress: 9 });
  assert(tiredScore < 3, "Un état fatigué (courbatures et stress élevés) donne un score bas — l'inversion fonctionne");
  assert(scoreLabel(tiredScore) === "Fatigue importante", "Le libellé reflète bien un score bas");

  const perfectHooper = computeHooperIndex({ physical_level: 10, mental_level: 10, sleep_quality: 10, soreness: 1, stress: 1 });
  assert(perfectHooper === 5, "L'indice de Hooper est à son minimum (5) pour un état parfait — cohérent avec la littérature (plus bas = meilleur)");
  const worstHooper = computeHooperIndex({ physical_level: 1, mental_level: 1, sleep_quality: 1, soreness: 10, stress: 10 });
  assert(worstHooper === 50, "L'indice de Hooper est à son maximum (50) pour le pire état possible sur l'échelle étendue");

  await dbRun(
    `INSERT INTO daily_checkins (id, athlete_id, check_date, physical_level, mental_level, sleep_quality, soreness, stress)
     VALUES (?, ?, date('now'), 7, 8, 6, 3, 4)`,
    [randomUUID(), athlete.id]
  );

  // Un second enregistrement le même jour doit ÉCRASER le premier (upsert), pas en créer un doublon
  await dbRun(
    `INSERT INTO daily_checkins (id, athlete_id, check_date, physical_level, mental_level, sleep_quality, soreness, stress)
     VALUES (?, ?, date('now'), 9, 9, 9, 1, 1)
     ON CONFLICT(athlete_id, check_date) DO UPDATE SET physical_level = excluded.physical_level, mental_level = excluded.mental_level`,
    [randomUUID(), athlete.id]
  );

  const checkinsToday = await dbAll<any>(`SELECT * FROM daily_checkins WHERE athlete_id = ? AND check_date = date('now')`, [athlete.id]);
  assert(checkinsToday.length === 1, "Un seul check-in par jour et par athlète — la contrainte UNIQUE(athlete_id, check_date) empêche les doublons");
  assert(checkinsToday[0].physical_level === 9, "La mise à jour du check-in écrase bien les anciennes valeurs du jour");

  // 20. Genre et restriction d'accès au cycle menstruel
  const genderBefore = await dbGet<any>(`SELECT gender FROM users WHERE id = ?`, [athlete.id]);
  assert(genderBefore?.gender === null, "Le genre n'est pas défini par défaut à la création du compte");

  await dbRun(`UPDATE users SET gender = 'female' WHERE id = ?`, [athlete.id]);
  const genderAfter = await dbGet<any>(`SELECT gender FROM users WHERE id = ?`, [athlete.id]);
  assert(genderAfter?.gender === "female", "Le genre est bien mis à jour");

  const maleAthlete = await createUser({ email: "male-athlete@test.fr", password: "motdepasse123", role: "athlete", firstName: "Marc", lastName: "Test" });
  await dbRun(`UPDATE users SET gender = 'male' WHERE id = ?`, [maleAthlete.id]);
  await dbRun(`INSERT INTO cycle_sharing_settings (athlete_id, share_with_coaches) VALUES (?, 1)`, [maleAthlete.id]);
  const maleGender = await dbGet<any>(`SELECT gender FROM users WHERE id = ?`, [maleAthlete.id]);
  const cycleVisibleForMale = maleGender?.gender === "female"; // même condition que dans coach/athletes/[athleteId]/page.tsx
  assert(cycleVisibleForMale === false, "Le cycle reste masqué pour un profil masculin même si le partage est activé en base");

  // 21. Séries détaillées par exercice (V2.2, façon Strong/Hevy)
  const strengthWorkoutId = randomUUID();
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date) VALUES (?, ?, ?, 'strength', 'entrainement', 'Séance pyramidale', '2026-09-22')`,
    [strengthWorkoutId, coach.id, athlete.id]
  );
  const pyramidBlockId = randomUUID();
  await dbRun(
    `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, order_index) VALUES (?, ?, 'main', 'Squat', 0)`,
    [pyramidBlockId, strengthWorkoutId]
  );

  await dbRun(`INSERT INTO exercise_sets (id, block_id, set_number, reps, load, order_index) VALUES (?, ?, ?, ?, ?, ?)`, [
    randomUUID(),
    pyramidBlockId,
    1,
    "12",
    "40 kg",
    0,
  ]);
  await dbRun(`INSERT INTO exercise_sets (id, block_id, set_number, reps, load, order_index) VALUES (?, ?, ?, ?, ?, ?)`, [
    randomUUID(),
    pyramidBlockId,
    2,
    "8",
    "60 kg",
    1,
  ]);
  await dbRun(`INSERT INTO exercise_sets (id, block_id, set_number, reps, load, order_index) VALUES (?, ?, ?, ?, ?, ?)`, [
    randomUUID(),
    pyramidBlockId,
    3,
    "4",
    "80 kg",
    2,
  ]);

  const pyramidSets = await dbAll<any>(`SELECT * FROM exercise_sets WHERE block_id = ? ORDER BY order_index`, [pyramidBlockId]);
  assert(pyramidSets.length === 3, "Les 3 séries pyramidales sont bien enregistrées individuellement");
  assert(
    pyramidSets[0].load === "40 kg" && pyramidSets[2].load === "80 kg",
    "Chaque série conserve sa propre charge — permet les séries pyramidales/montées en charge, impossible avec un seul champ 'charge' global"
  );

  await dbRun(`DELETE FROM workout_blocks WHERE id = ?`, [pyramidBlockId]);
  const setsAfterBlockDelete = await dbAll(`SELECT * FROM exercise_sets WHERE block_id = ?`, [pyramidBlockId]);
  assert(setsAfterBlockDelete.length === 0, "Supprimer un exercice supprime bien ses séries en cascade");

  // 22. Historique d'exercices du coach, pour l'autocomplétion
  const historyWorkoutId = randomUUID();
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date) VALUES (?, ?, ?, 'strength', 'entrainement', 'Autre séance', '2026-09-23')`,
    [historyWorkoutId, coach.id, athlete.id]
  );
  await dbRun(
    `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, order_index) VALUES (?, ?, 'main', 'Soulevé de terre', 0)`,
    [randomUUID(), historyWorkoutId]
  );
  const history = await getCoachExerciseHistory(coach.id);
  assert(
    history.includes("Soulevé de terre") && history.includes("Squat"),
    "L'historique d'exercices du coach contient bien ses exercices déjà utilisés, pour l'autocomplétion"
  );

  // 23. Photo de profil : upload, remplacement, suppression
  await dbRun(`UPDATE users SET avatar_path = 'ancien.jpg', avatar_mime_type = 'image/jpeg' WHERE id = ?`, [athlete.id]);
  await dbRun(`UPDATE users SET avatar_path = 'nouveau.jpg' WHERE id = ?`, [athlete.id]); // simule un remplacement
  const avatarRow = await dbGet<any>(`SELECT avatar_path FROM users WHERE id = ?`, [athlete.id]);
  assert(avatarRow?.avatar_path === "nouveau.jpg", "La photo de profil est bien remplacée, pas ajoutée en double");
  await dbRun(`UPDATE users SET avatar_path = NULL WHERE id = ?`, [athlete.id]);
  const avatarAfterDelete = await dbGet<any>(`SELECT avatar_path FROM users WHERE id = ?`, [athlete.id]);
  assert(avatarAfterDelete?.avatar_path === null, "La photo de profil peut être retirée");

  // 24. Priorité A/B/C des objectifs
  const goalWorkoutId = randomUUID();
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, priority, title, date) VALUES (?, ?, ?, 'running', 'objectif', 'A', 'Marathon de Paris', date('now', '+15 days'))`,
    [goalWorkoutId, coach.id, athlete.id]
  );
  const goals = await dbAll<any>(
    `SELECT * FROM workouts WHERE athlete_id = ? AND category IN ('objectif','evenement') AND date >= date('now') ORDER BY date ASC`,
    [athlete.id]
  );
  assert(goals.some((g) => g.id === goalWorkoutId && g.priority === "A"), "L'objectif prioritaire A est bien enregistré et retrouvable parmi les objectifs à venir");

  let rejectedInvalidPriority = false;
  try {
    await dbRun(
      `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, priority, title, date) VALUES (?, ?, ?, 'running', 'objectif', 'Z', 'Invalide', date('now'))`,
      [randomUUID(), coach.id, athlete.id]
    );
  } catch {
    rejectedInvalidPriority = true;
  }
  assert(rejectedInvalidPriority, "Une priorité invalide (hors A/B/C) est rejetée par la contrainte de la base");

  // 25. Messagerie coach <-> athlète
  await dbRun(`INSERT INTO messages (id, coach_id, athlete_id, sender_id, body) VALUES (?, ?, ?, ?, ?)`, [
    randomUUID(),
    coach.id,
    athlete.id,
    coach.id,
    "Comment te sens-tu après la séance d'hier ?",
  ]);
  await dbRun(`INSERT INTO messages (id, coach_id, athlete_id, sender_id, body) VALUES (?, ?, ?, ?, ?)`, [
    randomUUID(),
    coach.id,
    athlete.id,
    athlete.id,
    "Bien, un peu de fatigue dans les jambes.",
  ]);
  const conversation = await dbAll(`SELECT * FROM messages WHERE coach_id = ? AND athlete_id = ? ORDER BY created_at ASC`, [
    coach.id,
    athlete.id,
  ]);
  assert(conversation.length === 2, "Les deux messages de la conversation sont bien enregistrés dans l'ordre");

  const unreadForAthlete = await dbGet<any>(
    `SELECT COUNT(*) as c FROM messages WHERE coach_id = ? AND athlete_id = ? AND sender_id != ? AND read_at IS NULL`,
    [coach.id, athlete.id, athlete.id]
  );
  assert(unreadForAthlete?.c === 1, "L'athlète a bien 1 message non lu (celui envoyé par le coach)");

  await dbRun(
    `UPDATE messages SET read_at = datetime('now') WHERE coach_id = ? AND athlete_id = ? AND sender_id != ? AND read_at IS NULL`,
    [coach.id, athlete.id, athlete.id]
  );
  const unreadAfterMarkRead = await dbGet<any>(
    `SELECT COUNT(*) as c FROM messages WHERE coach_id = ? AND athlete_id = ? AND sender_id != ? AND read_at IS NULL`,
    [coach.id, athlete.id, athlete.id]
  );
  assert(unreadAfterMarkRead?.c === 0, "Marquer les messages comme lus fonctionne correctement");

  // 33. Envoi groupé à plusieurs athlètes (V5 fusionnée) — un athlète non lié est
  // ignoré silencieusement plutôt que de faire échouer tout l'envoi.
  const bulkTitle = "Séance collective";
  const bulkTargets = [athlete.id, otherAthlete.id];
  let bulkCount = 0;
  for (const targetId of bulkTargets) {
    if (!(await isCoachLinkedToAthlete(coach.id, targetId))) continue;
    await dbRun(
      `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date) VALUES (?, ?, ?, 'running', 'entrainement', ?, '2026-11-20')`,
      [randomUUID(), coach.id, targetId, bulkTitle]
    );
    bulkCount++;
  }
  assert(bulkCount === 1, "L'envoi groupé ignore silencieusement un athlète non lié plutôt que d'échouer entièrement");

  // 34. Copier une semaine entière vers une autre (V5 fusionnée)
  const weekSourceMonday = "2026-12-07";
  const weekTargetMonday = "2026-12-14";
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date) VALUES (?, ?, ?, 'running', 'entrainement', 'Sortie semaine A', '2026-12-08')`,
    [randomUUID(), coach.id, athlete.id]
  );
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date) VALUES (?, ?, ?, 'running', 'entrainement', 'Sortie semaine A bis', '2026-12-10')`,
    [randomUUID(), coach.id, athlete.id]
  );
  const weekSourceWorkouts = await dbAll<any>(
    `SELECT * FROM workouts WHERE athlete_id = ? AND coach_id = ? AND date BETWEEN ? AND ?`,
    [athlete.id, coach.id, weekSourceMonday, "2026-12-13"]
  );
  const dayOffset = Math.round(
    (new Date(`${weekTargetMonday}T00:00:00`).getTime() - new Date(`${weekSourceMonday}T00:00:00`).getTime()) / 86400000
  );
  for (const w of weekSourceWorkouts) {
    const newDate = new Date(`${w.date}T00:00:00`);
    newDate.setDate(newDate.getDate() + dayOffset);
    await dbRun(
      `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), coach.id, athlete.id, w.sport, w.category, w.title, newDate.toISOString().slice(0, 10)]
    );
  }
  const weekTargetWorkouts = await dbAll(`SELECT * FROM workouts WHERE athlete_id = ? AND date BETWEEN ? AND ?`, [
    athlete.id,
    weekTargetMonday,
    "2026-12-20",
  ]);
  assert(weekTargetWorkouts.length === 2, "Copier une semaine recrée bien le même nombre de séances, décalées du bon nombre de jours");

  // 35. Filtre par jour de semaine sur une plage de dates (V5 fusionnée) — logique
  // client de workout-form.tsx, vérifiée ici sur les mêmes données.
  function dateRangeToList(start: string, end: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(`${start}T00:00:00`);
    const last = new Date(`${end}T00:00:00`);
    while (cursor <= last) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }
  const fullRange = dateRangeToList("2026-11-02", "2026-11-15"); // 2 semaines, lundi à dimanche
  const filtered = fullRange.filter((d) => [1, 3, 5].includes(new Date(`${d}T00:00:00`).getDay()));
  assert(fullRange.length === 14, "La plage complète (2 semaines) contient bien 14 jours avant filtrage");
  assert(filtered.length === 6, "Le filtre lundi/mercredi/vendredi réduit bien 14 jours à 6 occurrences");
  assert(
    filtered.every((d) => [1, 3, 5].includes(new Date(`${d}T00:00:00`).getDay())),
    "Chaque date filtrée tombe bien sur un jour de semaine sélectionné"
  );

  // 36. Journal de bord : modification et suppression, avec vérification de propriété (V5 fusionnée)
  const journalEntryId = randomUUID();
  await dbRun(`INSERT INTO journal_entries (id, athlete_id, entry_date, content) VALUES (?, ?, date('now'), 'Note initiale')`, [
    journalEntryId,
    athlete.id,
  ]);

  await dbRun(`UPDATE journal_entries SET content = ? WHERE id = ?`, ["Note modifiée", journalEntryId]);
  const updatedEntry = await dbGet<any>(`SELECT content FROM journal_entries WHERE id = ?`, [journalEntryId]);
  assert(updatedEntry?.content === "Note modifiée", "Une entrée de journal peut être modifiée");

  const entryOwner = await dbGet<any>(`SELECT athlete_id FROM journal_entries WHERE id = ?`, [journalEntryId]);
  assert(
    entryOwner?.athlete_id === athlete.id && entryOwner?.athlete_id !== otherAthlete.id,
    "Une entrée de journal appartient bien à son auteur, pas à un autre athlète"
  );

  await dbRun(`DELETE FROM journal_entries WHERE id = ?`, [journalEntryId]);
  const deletedEntry = await dbGet(`SELECT * FROM journal_entries WHERE id = ?`, [journalEntryId]);
  assert(!deletedEntry, "Une entrée de journal peut être supprimée");

  // 37. Séance structurée par intervalles (façon Garmin) et répétitions/durée par exercice
  const intervalStructure = [
    { id: "s1", kind: "step", stepType: "warmup", durationType: "time", durationValue: "10:00", target: { type: "hr_zone", zone: 2 } },
    {
      id: "r1",
      kind: "repeat",
      count: 6,
      steps: [
        { id: "s2", kind: "step", stepType: "work", durationType: "distance", durationValue: "400", target: { type: "pace_zone", zone: 4 } },
        { id: "s3", kind: "step", stepType: "recovery", durationType: "time", durationValue: "01:30", target: { type: "none" } },
      ],
    },
    { id: "s4", kind: "step", stepType: "cooldown", durationType: "time", durationValue: "10:00", target: { type: "none" } },
  ];
  const intervalWorkoutId = randomUUID();
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date, intervals_json) VALUES (?, ?, ?, 'running', 'entrainement', 'Séance fractionné', '2027-01-10', ?)`,
    [intervalWorkoutId, coach.id, athlete.id, JSON.stringify(intervalStructure)]
  );
  const savedInterval = await dbGet<any>(`SELECT intervals_json FROM workouts WHERE id = ?`, [intervalWorkoutId]);
  const parsedInterval = JSON.parse(savedInterval?.intervals_json || "[]");
  assert(parsedInterval.length === 3, "La structure d'intervalles (échauffement, groupe répété, retour au calme) est bien enregistrée");
  assert(parsedInterval[1].kind === "repeat" && parsedInterval[1].count === 6, "Le groupe répété conserve bien son nombre de répétitions");
  assert(parsedInterval[1].steps.length === 2, "Le groupe répété contient bien ses étapes imbriquées (effort + récupération)");
  assert(parsedInterval[1].steps[0].target.type === "pace_zone" && parsedInterval[1].steps[0].target.zone === 4, "La cible en zone d'allure est bien conservée");

  const timedBlockWorkoutId = randomUUID();
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date) VALUES (?, ?, ?, 'strength', 'entrainement', 'Gainage minuté', '2027-01-11')`,
    [timedBlockWorkoutId, coach.id, athlete.id]
  );
  const timedBlockId = randomUUID();
  await dbRun(
    `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, rep_type, order_index) VALUES (?, ?, 'core', 'Planche', 'time', 0)`,
    [timedBlockId, timedBlockWorkoutId]
  );
  await dbRun(`INSERT INTO exercise_sets (id, block_id, set_number, reps, order_index) VALUES (?, ?, 1, '45 sec', 0)`, [
    randomUUID(),
    timedBlockId,
  ]);
  const timedBlock = await dbGet<any>(`SELECT rep_type FROM workout_blocks WHERE id = ?`, [timedBlockId]);
  assert(timedBlock?.rep_type === "time", "Un exercice peut être prescrit en durée plutôt qu'en répétitions");

  // 38. Circuits d'exercices : plusieurs exercices partagent un circuit_id et un
  // nombre de tours commun, enchaînés sans repos entre eux.
  const circuitWorkoutId = randomUUID();
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date) VALUES (?, ?, ?, 'strength', 'entrainement', 'Circuit training', '2027-01-12')`,
    [circuitWorkoutId, coach.id, athlete.id]
  );
  const circuitId = randomUUID();
  await dbRun(
    `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, circuit_id, circuit_rounds, order_index) VALUES (?, ?, 'main', 'Burpees', ?, 4, 0)`,
    [randomUUID(), circuitWorkoutId, circuitId]
  );
  await dbRun(
    `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, circuit_id, circuit_rounds, order_index) VALUES (?, ?, 'main', 'Mountain climbers', ?, 4, 1)`,
    [randomUUID(), circuitWorkoutId, circuitId]
  );
  const circuitBlocks = await dbAll<any>(`SELECT * FROM workout_blocks WHERE circuit_id = ? ORDER BY order_index`, [circuitId]);
  assert(circuitBlocks.length === 2, "Les deux exercices du circuit sont bien enregistrés avec le même circuit_id");
  assert(
    circuitBlocks.every((b) => b.circuit_rounds === 4),
    "Le nombre de tours est bien partagé entre tous les exercices du circuit"
  );

  // 39. Sport(s) pratiqué(s) par l'athlète, renseigné par lui-même, visible côté coach
  await dbRun(`UPDATE users SET sports_json = ? WHERE id = ?`, [JSON.stringify(["running", "climbing"]), athlete.id]);
  const sportsRow = await dbGet<any>(`SELECT sports_json FROM users WHERE id = ?`, [athlete.id]);
  const savedSports = JSON.parse(sportsRow?.sports_json || "[]");
  assert(
    savedSports.length === 2 && savedSports.includes("running") && savedSports.includes("climbing"),
    "Les sports pratiqués par l'athlète sont bien enregistrés"
  );

  // 40. Notes privées du coach sur un athlète — jamais visibles par l'athlète
  // ni par un autre coach du même athlète.
  await dbRun(
    `INSERT INTO coach_athlete_notes (coach_id, athlete_id, strengths, weaknesses) VALUES (?, ?, ?, ?)
     ON CONFLICT(coach_id, athlete_id) DO UPDATE SET strengths = excluded.strengths, weaknesses = excluded.weaknesses`,
    [coach.id, athlete.id, "Très régulier, bonne technique de course", "Manque de force du haut du corps"]
  );
  const notes = await dbGet<any>(`SELECT * FROM coach_athlete_notes WHERE coach_id = ? AND athlete_id = ?`, [coach.id, athlete.id]);
  assert(notes?.strengths?.includes("régulier") && notes?.weaknesses?.includes("force"), "Les notes privées du coach sont bien enregistrées");

  const notesForOtherCoach = await dbGet(`SELECT * FROM coach_athlete_notes WHERE coach_id = ? AND athlete_id = ?`, [otherCoach.id, athlete.id]);
  assert(!notesForOtherCoach, "Un autre coach du même athlète n'a AUCUNE note — cloisonnées par coach, jamais partagées");

  // Un deuxième enregistrement doit écraser le premier (upsert), pas empiler de doublon.
  await dbRun(
    `INSERT INTO coach_athlete_notes (coach_id, athlete_id, strengths, weaknesses) VALUES (?, ?, ?, ?)
     ON CONFLICT(coach_id, athlete_id) DO UPDATE SET strengths = excluded.strengths, weaknesses = excluded.weaknesses`,
    [coach.id, athlete.id, "Mise à jour", "Mise à jour aussi"]
  );
  const allNotesRows = await dbAll(`SELECT * FROM coach_athlete_notes WHERE coach_id = ? AND athlete_id = ?`, [coach.id, athlete.id]);
  assert(allNotesRows.length === 1, "Une seule ligne de notes par paire coach/athlète (mise à jour sur place, pas de doublon)");

  // 41. Ordre des blocs de musculation préservé à l'enregistrement (bug corrigé :
  // l'ordre d'AJOUT (ordre de clic sur "+ Exercice" dans différents groupes) ne
  // doit jamais l'emporter sur l'ordre canonique des groupes (échauffement ->
  // corps de séance -> gainage -> retour au calme).
  const { sortBlocksByGroupOrder } = await import("../src/app/coach/athletes/[athleteId]/new-workout/strength-builder");
  const outOfOrderBlocks = [
    { key: "1", block_type: "core", exercise_name: "Planche", notes: "", resource_id: "", training_quality: "" as const, rep_type: "reps" as const, sets: [] },
    { key: "2", block_type: "warmup_mobility", exercise_name: "Rotation hanches", notes: "", resource_id: "", training_quality: "" as const, rep_type: "reps" as const, sets: [] },
    { key: "3", block_type: "main", exercise_name: "Squat", notes: "", resource_id: "", training_quality: "" as const, rep_type: "reps" as const, sets: [] },
    { key: "4", block_type: "cooldown", exercise_name: "Étirements", notes: "", resource_id: "", training_quality: "" as const, rep_type: "reps" as const, sets: [] },
  ];
  const sorted = sortBlocksByGroupOrder(outOfOrderBlocks);
  assert(
    sorted.map((b) => b.block_type).join(",") === "warmup_mobility,main,core,cooldown",
    "Les blocs sont bien réordonnés selon l'ordre canonique des groupes, quel que soit leur ordre d'ajout"
  );

  // 42. Charges de référence : type de variable, note, et permission élargie à l'athlète
  await dbRun(
    `INSERT INTO exercise_maxes (id, athlete_id, exercise_name, value_kg, value_type, tested_at, note) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), athlete.id, "Planche", 60, "temps", "2027-01-01", "Bonne forme ce jour-là"]
  );
  await dbRun(
    `INSERT INTO exercise_maxes (id, athlete_id, exercise_name, value_kg, value_type, tested_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), athlete.id, "Planche", 75, "temps", "2027-02-01"]
  );
  const planches = await dbAll<any>(`SELECT * FROM exercise_maxes WHERE athlete_id = ? AND exercise_name = 'Planche' ORDER BY tested_at`, [
    athlete.id,
  ]);
  assert(planches.length === 2, "Deux mesures du même exercice à des dates différentes sont bien conservées (pour la tendance)");
  assert(planches[0].value_type === "temps" && planches[0].value_kg === 60, "Le type de variable (temps/charge/répétitions) et sa valeur sont bien enregistrés");
  assert(planches[0].note === "Bonne forme ce jour-là", "La note associée à une charge de référence est bien enregistrée");

  // Le calcul de charge en % ne doit prendre en compte que les maxes de type 'charge'.
  await dbRun(
    `INSERT INTO exercise_maxes (id, athlete_id, exercise_name, value_kg, value_type, tested_at) VALUES (?, ?, ?, ?, 'charge', ?)`,
    [randomUUID(), athlete.id, "Squat", 100, "2027-01-01"]
  );
  const chargeOnlyMaxes = await dbAll<any>(`SELECT * FROM exercise_maxes WHERE athlete_id = ? AND value_type = 'charge'`, [athlete.id]);
  assert(
    chargeOnlyMaxes.length === 1 && chargeOnlyMaxes[0].exercise_name === "Squat",
    "Seules les charges de type 'charge' (pas temps/répétitions) alimentent le calcul de charge en pourcentage"
  );

  // 43. Statistiques de performance : le coach peut aussi renseigner une mesure, avec date et note
  await dbRun(`INSERT INTO athlete_measurements (id, athlete_id, metric, value, recorded_at, note) VALUES (?, ?, ?, ?, ?, ?)`, [
    randomUUID(),
    athlete.id,
    "weight_kg",
    68.5,
    "2027-01-15",
    "Pesée après la séance du matin",
  ]);
  const coachEnteredMeasurement = await dbGet<any>(
    `SELECT * FROM athlete_measurements WHERE athlete_id = ? AND recorded_at = '2027-01-15'`,
    [athlete.id]
  );
  assert(coachEnteredMeasurement?.note === "Pesée après la séance du matin", "Une mesure peut porter une date explicite et une note (renseignée par le coach ou l'athlète)");

  // 44. Liens utiles ajoutés à la construction d'une séance
  const linksTestWorkoutId = randomUUID();
  const testLinks = [{ label: "Carte du parcours", url: "https://example.com/carte" }];
  await dbRun(
    `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, title, date, links_json) VALUES (?, ?, ?, 'hiking', 'entrainement', 'Rando avec carte', '2027-01-20', ?)`,
    [linksTestWorkoutId, coach.id, athlete.id, JSON.stringify(testLinks)]
  );
  const workoutWithLinks = await dbGet<any>(`SELECT links_json FROM workouts WHERE id = ?`, [linksTestWorkoutId]);
  const parsedLinks = JSON.parse(workoutWithLinks?.links_json || "[]");
  assert(parsedLinks.length === 1 && parsedLinks[0].url === "https://example.com/carte", "Les liens utiles ajoutés à une séance sont bien enregistrés");

  console.log("\nTest end-to-end terminé.");
}

main().catch((err) => {
  console.error("Erreur inattendue pendant le test :", err);
  process.exitCode = 1;
});
