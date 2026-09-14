"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { dbGet, dbRun, dbAll } from "./db";
import { todayISO } from "./dates";
import {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  createSession,
  destroySession,
  destroyAllSessionsForUser,
  getCurrentUser,
  isCoachLinkedToAthlete,
  createPasswordResetToken,
  consumePasswordResetToken,
  updateUserPassword,
  Role,
} from "./auth";
import { saveUploadedFile, deleteUploadedFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "./storage";
import { parseGpx, simplifyRoute } from "./gpx";
import { getResourceById, getBlocksForWorkout } from "./queries";
import { createNotification, markNotificationRead, markAllNotificationsRead } from "./notifications";
import { saveSubscription, removeSubscription } from "./push";

// ---------- AUTH ----------

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "Email ou mot de passe incorrect." };
  }
  await createSession(user.id);
  redirect(user.role === "coach" ? "/coach" : "/athlete");
}

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const role = String(formData.get("role") || "athlete") as Role;
  const inviteToken = String(formData.get("inviteToken") || "").trim();
  const acceptedTerms = formData.get("acceptedTerms") === "on";

  if (!email || !password || !firstName || !lastName) {
    return { error: "Tous les champs sont obligatoires." };
  }
  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (!acceptedTerms) {
    return { error: "Vous devez accepter les conditions d'utilisation pour créer un compte." };
  }
  if (await findUserByEmail(email)) {
    return { error: "Un compte existe déjà avec cet email." };
  }

  const user = await createUser({ email, password, role, firstName, lastName });
  await dbRun(`UPDATE users SET accepted_terms_at = datetime('now') WHERE id = ?`, [user.id]);

  // Si un code d'invitation a été fourni (athlète invité par un coach), on active le lien.
  if (inviteToken && role === "athlete") {
    const invite = await dbGet<any>(`SELECT * FROM coach_athlete_links WHERE invite_token = ? AND status = 'pending'`, [
      inviteToken,
    ]);
    if (invite) {
      await dbRun(
        `UPDATE coach_athlete_links SET athlete_id = ?, status = 'active', accepted_at = datetime('now') WHERE id = ?`,
        [user.id, invite.id]
      );
    }
  }

  await createSession(user.id);
  redirect(role === "coach" ? "/coach" : "/athlete");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ---------- INVITATIONS (cf. prompt : "Flux d'invitation/liaison") ----------

export async function createInviteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");

  const email = String(formData.get("email") || "").trim();
  const token = randomUUID().slice(0, 8);

  await dbRun(
    `INSERT INTO coach_athlete_links (id, coach_id, invite_email, invite_token, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [randomUUID(), user.id, email || null, token]
  );

  revalidatePath("/coach");
  return { token };
}

export async function revokeAthleteAccessAction(linkId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");

  // Un athlète peut révoquer un coach ; un coach peut retirer un athlète.
  const link = await dbGet<any>(`SELECT * FROM coach_athlete_links WHERE id = ?`, [linkId]);
  if (!link) return;
  if (link.coach_id !== user.id && link.athlete_id !== user.id) throw new Error("Non autorisé.");

  await dbRun(`UPDATE coach_athlete_links SET status = 'revoked' WHERE id = ?`, [linkId]);
  revalidatePath("/coach");
  revalidatePath("/athlete");
}

// Un athlète existant peut aussi rejoindre un coach via un code, sans repasser par l'inscription.
export async function joinCoachWithCodeAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const token = String(formData.get("inviteToken") || "").trim();
  const invite = await dbGet<any>(`SELECT * FROM coach_athlete_links WHERE invite_token = ? AND status = 'pending'`, [
    token,
  ]);
  if (!invite) return { error: "Code d'invitation invalide ou déjà utilisé." };

  await dbRun(
    `UPDATE coach_athlete_links SET athlete_id = ?, status = 'active', accepted_at = datetime('now') WHERE id = ?`,
    [user.id, invite.id]
  );

  revalidatePath("/athlete");
  return { success: true };
}

// ---------- WORKOUTS (cf. prompt : "Création d'entraînement") ----------

export interface SetInput {
  reps?: string;
  load?: string;
  restSeconds?: number;
  rpe?: number;
}

// Qualité physique travaillée — cf. periodisation classique (Bompa/NSCA) :
// détermine quels champs sont pertinents par série (charge lourde + repos long
// pour la force max, peu de reps pour l'explosivité, reps hautes + repos court
// pour la force-endurance, durée/intensité plutôt que charge pour le cardio).
export type TrainingQuality = "force_max" | "explosivite" | "force_endurance" | "cardio";

export interface BlockInput {
  block_type: string;
  exercise_name: string;
  notes?: string;
  resource_id?: string;
  training_quality?: TrainingQuality;
  sets?: SetInput[];
}

export async function createWorkoutAction(params: {
  athleteId: string;
  sport: string;
  category: string;
  priority?: string;
  title: string;
  dates: string[];
  time?: string;
  durationMinutes?: number;
  description?: string;
  color?: string;
  blocks?: BlockInput[];
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");
  if (!(await isCoachLinkedToAthlete(user.id, params.athleteId))) {
    throw new Error("Ce coach n'est pas lié à cet athlète.");
  }
  if (!params.dates.length) throw new Error("Choisissez au moins un jour.");

  // Résolu une seule fois (pas par date créée) : un exercice ne peut pointer
  // que vers une ressource appartenant au coach qui crée la séance.
  const resolvedBlocks =
    params.sport === "strength" && params.blocks?.length
      ? await Promise.all(
          params.blocks
            .filter((b) => b.exercise_name)
            .map(async (b) => {
              let resourceId: string | null = null;
              if (b.resource_id) {
                const resource = await dbGet<any>(`SELECT coach_id FROM resources WHERE id = ?`, [b.resource_id]);
                if (resource && resource.coach_id === user.id) resourceId = b.resource_id;
              }
              return { ...b, resourceId };
            })
        )
      : [];

  const priority = params.category === "objectif" || params.category === "evenement" ? params.priority || null : null;
  const color = params.color || "#1B4B4F";

  const workoutIds = await Promise.all(
    params.dates.map(async (date) => {
      const workoutId = randomUUID();
      await dbRun(
        `INSERT INTO workouts (id, coach_id, athlete_id, sport, category, priority, title, date, time, duration_minutes, description, color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workoutId,
          user.id,
          params.athleteId,
          params.sport,
          params.category,
          priority,
          params.title,
          date,
          params.time || null,
          params.durationMinutes || null,
          params.description || null,
          color,
        ]
      );

      let idx = 0;
      for (const b of resolvedBlocks) {
        const blockId = randomUUID();
        await dbRun(
          `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, notes, resource_id, order_index, training_quality)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [blockId, workoutId, b.block_type, b.exercise_name, b.notes || null, b.resourceId, idx, b.training_quality || null]
        );

        let setIdx = 0;
        for (const s of b.sets || []) {
          if (s.reps || s.load) {
            await dbRun(
              `INSERT INTO exercise_sets (id, block_id, set_number, reps, load, rest_seconds, rpe, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [randomUUID(), blockId, setIdx + 1, s.reps || null, s.load || null, s.restSeconds || null, s.rpe || null, setIdx]
            );
          }
          setIdx++;
        }
        idx++;
      }

      return workoutId;
    })
  );

  revalidatePath(`/coach/athletes/${params.athleteId}`);
  revalidatePath("/athlete");

  const body =
    params.dates.length === 1
      ? `« ${params.title} » prévue le ${params.dates[0]}.`
      : `« ${params.title} » prévue ${params.dates.length} jours, du ${params.dates[0]} au ${params.dates[params.dates.length - 1]}.`;
  await createNotification({
    userId: params.athleteId,
    type: "new_workout",
    title: "Nouvelle séance",
    body,
    link: `/workouts/${workoutIds[0]}`,
  });

  return { workoutIds };
}

// Modification d'une séance déjà créée par le coach — reprend la même logique
// de résolution/insertion des blocs que createWorkoutAction, mais pour une
// séance unique déjà existante (contrairement à la création, l'édition ne
// porte jamais sur une plage de dates : chaque jour créé via le sélecteur
// Booking reste un enregistrement `workouts` indépendant).
export async function updateWorkoutAction(params: {
  workoutId: string;
  sport: string;
  category: string;
  priority?: string;
  title: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  description?: string;
  color?: string;
  blocks?: BlockInput[];
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");

  const workout = await dbGet<any>(`SELECT * FROM workouts WHERE id = ?`, [params.workoutId]);
  if (!workout) throw new Error("Séance introuvable.");
  if (workout.coach_id !== user.id) throw new Error("Non autorisé.");
  if (!params.date) throw new Error("Choisissez un jour.");

  const resolvedBlocks =
    params.sport === "strength" && params.blocks?.length
      ? await Promise.all(
          params.blocks
            .filter((b) => b.exercise_name)
            .map(async (b) => {
              let resourceId: string | null = null;
              if (b.resource_id) {
                const resource = await dbGet<any>(`SELECT coach_id FROM resources WHERE id = ?`, [b.resource_id]);
                if (resource && resource.coach_id === user.id) resourceId = b.resource_id;
              }
              return { ...b, resourceId };
            })
        )
      : [];

  const priority = params.category === "objectif" || params.category === "evenement" ? params.priority || null : null;
  const color = params.color || "#1B4B4F";

  await dbRun(
    `UPDATE workouts SET sport = ?, category = ?, priority = ?, title = ?, date = ?, time = ?, duration_minutes = ?, description = ?, color = ?
     WHERE id = ?`,
    [
      params.sport,
      params.category,
      priority,
      params.title,
      params.date,
      params.time || null,
      params.durationMinutes || null,
      params.description || null,
      color,
      params.workoutId,
    ]
  );

  // Reconstruit entièrement la structure (blocs + séries) plutôt que de tenter
  // un diff — cascade FK sur workout_blocks -> exercise_sets (PRAGMA foreign_keys
  // activé dans ce module), donc un seul DELETE suffit à tout nettoyer.
  await dbRun(`DELETE FROM workout_blocks WHERE workout_id = ?`, [params.workoutId]);

  let idx = 0;
  for (const b of resolvedBlocks) {
    const blockId = randomUUID();
    await dbRun(
      `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, notes, resource_id, order_index, training_quality)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [blockId, params.workoutId, b.block_type, b.exercise_name, b.notes || null, b.resourceId, idx, b.training_quality || null]
    );

    let setIdx = 0;
    for (const s of b.sets || []) {
      if (s.reps || s.load) {
        await dbRun(
          `INSERT INTO exercise_sets (id, block_id, set_number, reps, load, rest_seconds, rpe, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), blockId, setIdx + 1, s.reps || null, s.load || null, s.restSeconds || null, s.rpe || null, setIdx]
        );
      }
      setIdx++;
    }
    idx++;
  }

  revalidatePath(`/workouts/${params.workoutId}`);
  revalidatePath(`/coach/athletes/${workout.athlete_id}`);
  revalidatePath("/athlete");
  revalidatePath(`/athlete/day/${params.date}`);
  if (params.date !== workout.date) revalidatePath(`/athlete/day/${workout.date}`);

  await createNotification({
    userId: workout.athlete_id,
    type: "workout_updated",
    title: "Séance modifiée",
    body: `« ${params.title} » a été modifiée par votre coach.`,
    link: `/workouts/${params.workoutId}`,
  });
}

export async function updateWorkoutStatusAction(params: {
  workoutId: string;
  status: "done" | "not_done" | "partial" | "postponed";
  rpe?: number;
  athleteFeedback?: string;
  actualDurationMinutes?: number;
  distanceKm?: number;
  avgHr?: number;
  elevationGainM?: number;
  avgPowerW?: number;
  // Nouveau jour choisi par l'athlète pour une séance reportée — une séance
  // "reportée" n'est pas un état permanent, c'est une transition vers un
  // autre jour : dès qu'un nouveau jour est fourni, le statut repasse à
  // "planned" à cette date plutôt que de rester marquée "reportée" pour
  // toujours à son ancienne date.
  postponedToDate?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");

  const workout = await dbGet<any>(`SELECT * FROM workouts WHERE id = ?`, [params.workoutId]);
  if (!workout) throw new Error("Séance introuvable.");
  if (workout.athlete_id !== user.id && workout.coach_id !== user.id) {
    throw new Error("Non autorisé.");
  }

  const isReschedule = params.status === "postponed" && !!params.postponedToDate;
  const finalStatus = isReschedule ? "planned" : params.status;
  const finalDate = isReschedule ? params.postponedToDate! : workout.date;
  // Un report n'est pas un retour d'entraînement : aucun de ces champs ne
  // s'applique à une séance qui n'a pas eu lieu, quoi que le client envoie.
  const feedbackFields = isReschedule
    ? { rpe: null, athleteFeedback: null, actualDurationMinutes: null, distanceKm: null, avgHr: null, elevationGainM: null, avgPowerW: null }
    : params;

  await dbRun(
    `UPDATE workouts SET status = ?, date = ?, rpe = ?, athlete_feedback = ?, actual_duration_minutes = ?, distance_km = ?, avg_hr = ?, elevation_gain_m = ?, avg_power_w = ?
     WHERE id = ?`,
    [
      finalStatus,
      finalDate,
      feedbackFields.rpe ?? null,
      feedbackFields.athleteFeedback ?? null,
      feedbackFields.actualDurationMinutes ?? null,
      feedbackFields.distanceKm ?? null,
      feedbackFields.avgHr ?? null,
      feedbackFields.elevationGainM ?? null,
      feedbackFields.avgPowerW ?? null,
      params.workoutId,
    ]
  );

  revalidatePath(`/workouts/${params.workoutId}`);
  revalidatePath("/athlete");
  revalidatePath(`/coach/athletes/${workout.athlete_id}`);
  revalidatePath(`/athlete/day/${workout.date}`);
  if (isReschedule && finalDate !== workout.date) {
    revalidatePath(`/athlete/day/${finalDate}`);
    await createNotification({
      userId: workout.coach_id,
      type: "workout_updated",
      title: "Séance reportée",
      body: `« ${workout.title} » a été reportée par l'athlète du ${workout.date} au ${finalDate}.`,
      link: `/workouts/${params.workoutId}`,
    });
  }
}

// ---------- MODÈLES DE SÉANCE ----------
// Gagner le temps perdu à recréer la même structure de séance chaque semaine
// ou pour chaque athlète — le modèle capture sport/catégorie/durée/description
// et, pour la musculation, la structure de blocs complète.

export async function saveWorkoutTemplateAction(params: {
  name: string;
  sport: string;
  category: string;
  durationMinutes?: number;
  description?: string;
  color?: string;
  blocks?: BlockInput[];
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");
  const name = params.name.trim();
  if (!name) throw new Error("Nom du modèle requis.");

  await dbRun(
    `INSERT INTO workout_templates (id, coach_id, name, sport, category, duration_minutes, description, color, blocks_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      user.id,
      name,
      params.sport,
      params.category,
      params.durationMinutes ?? null,
      params.description ?? null,
      params.color || "#1B4B4F",
      params.blocks?.length ? JSON.stringify(params.blocks) : null,
    ]
  );
}

export async function deleteWorkoutTemplateAction(id: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");

  const tpl = await dbGet<any>(`SELECT coach_id FROM workout_templates WHERE id = ?`, [id]);
  if (!tpl || tpl.coach_id !== user.id) throw new Error("Non autorisé.");

  await dbRun(`DELETE FROM workout_templates WHERE id = ?`, [id]);
}

// Duplique une séance déjà créée (avec sa structure de blocs le cas échéant)
// vers un autre jour et/ou un autre athlète du même coach — s'appuie sur
// createWorkoutAction plutôt que de dupliquer sa logique d'insertion.
export async function duplicateWorkoutAction(params: { workoutId: string; targetDate: string; targetAthleteId?: string }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");

  const workout = await dbGet<any>(`SELECT * FROM workouts WHERE id = ?`, [params.workoutId]);
  if (!workout) throw new Error("Séance introuvable.");
  if (workout.coach_id !== user.id) throw new Error("Non autorisé.");

  const targetAthleteId = params.targetAthleteId || workout.athlete_id;
  if (!(await isCoachLinkedToAthlete(user.id, targetAthleteId))) throw new Error("Non autorisé.");

  const blocks = workout.sport === "strength" ? await getBlocksForWorkout(params.workoutId) : [];
  const blockInputs: BlockInput[] = blocks.map((b: any) => ({
    block_type: b.block_type,
    exercise_name: b.exercise_name,
    notes: b.notes || undefined,
    resource_id: b.resource_id || undefined,
    training_quality: b.training_quality || undefined,
    sets: (b.exerciseSets || []).map((s: any) => ({
      reps: s.reps || undefined,
      load: s.load || undefined,
      restSeconds: s.rest_seconds || undefined,
      rpe: s.rpe || undefined,
    })),
  }));

  return createWorkoutAction({
    athleteId: targetAthleteId,
    sport: workout.sport,
    category: workout.category,
    priority: workout.priority || undefined,
    title: workout.title,
    dates: [params.targetDate],
    time: workout.time || undefined,
    durationMinutes: workout.duration_minutes || undefined,
    description: workout.description || undefined,
    color: workout.color,
    blocks: blockInputs.length ? blockInputs : undefined,
  });
}

// Envoi de la même séance à plusieurs athlètes d'un coup (cf. besoin coach : une
// séance collective). Réutilise createWorkoutAction athlète par athlète plutôt que
// de dupliquer sa logique d'insertion — un athlète non lié est ignoré silencieusement
// (pas d'échec en cascade pour tout le monde à cause d'un seul athlète invalide).
export async function createWorkoutBulkAction(params: {
  athleteIds: string[];
  sport: string;
  category: string;
  priority?: string;
  title: string;
  dates: string[];
  time?: string;
  durationMinutes?: number;
  description?: string;
  color?: string;
  blocks?: BlockInput[];
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");
  if (!params.athleteIds.length) return { count: 0 };

  let count = 0;
  for (const athleteId of params.athleteIds) {
    if (!(await isCoachLinkedToAthlete(user.id, athleteId))) continue;
    await createWorkoutAction({ ...params, athleteId });
    count++;
  }
  return { count };
}

// Copie toute une semaine de séances d'un athlète vers une autre semaine (cf.
// besoin coach : reconduire un microcycle qui a bien fonctionné). Uniquement les
// séances créées par CE coach (pas celles d'un autre coach du même athlète) —
// même règle que "chaque coach ne voit/modifie que ses propres séances".
export async function copyWeekAction(params: {
  athleteId: string;
  sourceWeekStart: string; // lundi de la semaine source, YYYY-MM-DD
  targetWeekStart: string; // lundi de la semaine cible
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");
  if (!(await isCoachLinkedToAthlete(user.id, params.athleteId))) {
    throw new Error("Ce coach n'est pas lié à cet athlète.");
  }

  const sourceStart = new Date(`${params.sourceWeekStart}T00:00:00`);
  const sourceEnd = new Date(sourceStart);
  sourceEnd.setDate(sourceEnd.getDate() + 6);
  const dayOffset = Math.round(
    (new Date(`${params.targetWeekStart}T00:00:00`).getTime() - sourceStart.getTime()) / 86400000
  );

  const sourceWorkouts = await dbAll<any>(
    `SELECT * FROM workouts WHERE athlete_id = ? AND coach_id = ? AND date BETWEEN ? AND ?`,
    [params.athleteId, user.id, params.sourceWeekStart, sourceEnd.toISOString().slice(0, 10)]
  );

  let count = 0;
  for (const w of sourceWorkouts) {
    const blocks = w.sport === "strength" ? await getBlocksForWorkout(w.id) : [];
    const blockInputs: BlockInput[] = blocks.map((b: any) => ({
      block_type: b.block_type,
      exercise_name: b.exercise_name,
      notes: b.notes || undefined,
      resource_id: b.resource_id || undefined,
      training_quality: b.training_quality || undefined,
      sets: (b.exerciseSets || []).map((s: any) => ({
        reps: s.reps || undefined,
        load: s.load || undefined,
        restSeconds: s.rest_seconds || undefined,
        rpe: s.rpe || undefined,
      })),
    }));

    const newDate = new Date(`${w.date}T00:00:00`);
    newDate.setDate(newDate.getDate() + dayOffset);

    await createWorkoutAction({
      athleteId: params.athleteId,
      sport: w.sport,
      category: w.category,
      priority: w.priority || undefined,
      title: w.title,
      dates: [newDate.toISOString().slice(0, 10)],
      time: w.time || undefined,
      durationMinutes: w.duration_minutes || undefined,
      description: w.description || undefined,
      color: w.color,
      blocks: blockInputs.length ? blockInputs : undefined,
    });
    count++;
  }

  return { count };
}

// Annulation d'une séance par le coach (cf. prompt : "séance modifiée/annulée" parmi
// les événements devant déclencher une notification).
export async function cancelWorkoutAction(workoutId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");

  const workout = await dbGet<any>(`SELECT * FROM workouts WHERE id = ?`, [workoutId]);
  if (!workout) return;
  if (workout.coach_id !== user.id) throw new Error("Non autorisé.");

  await dbRun(`DELETE FROM workouts WHERE id = ?`, [workoutId]);

  await createNotification({
    userId: workout.athlete_id,
    type: "workout_cancelled",
    title: "Séance annulée",
    body: `« ${workout.title} » prévue le ${workout.date} a été annulée par votre coach.`,
  });

  revalidatePath(`/coach/athletes/${workout.athlete_id}`);
  revalidatePath("/athlete");
  redirect(`/coach/athletes/${workout.athlete_id}`);
}

// Une vidéo (exécution d'un mouvement côté athlète, correction côté coach)
// peut accompagner ou remplacer le texte — mêmes contraintes de format/
// taille que la bibliothèque de ressources, même stockage (cf. storage.ts).
export async function addWorkoutCommentAction(workoutId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");

  const body = String(formData.get("body") || "").trim();
  const file = formData.get("video") as File | null;
  if (!body && (!file || file.size === 0)) return;

  const workout = await dbGet<any>(`SELECT * FROM workouts WHERE id = ?`, [workoutId]);
  if (!workout) throw new Error("Séance introuvable.");
  if (workout.athlete_id !== user.id && workout.coach_id !== user.id) {
    throw new Error("Non autorisé.");
  }

  let videoPath: string | null = null;
  if (file && file.size > 0) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) throw new Error("Format de vidéo non supporté.");
    if (file.size > MAX_FILE_SIZE_BYTES) throw new Error("Vidéo trop volumineuse (50 Mo max).");
    const saved = await saveUploadedFile(file);
    videoPath = saved.storedName;
  }

  const finalBody = body || "Vidéo jointe";

  await dbRun(`INSERT INTO workout_comments (id, workout_id, author_id, body, video_path) VALUES (?, ?, ?, ?, ?)`, [
    randomUUID(),
    workoutId,
    user.id,
    finalBody,
    videoPath,
  ]);

  revalidatePath(`/workouts/${workoutId}`);

  const recipientId = workout.athlete_id === user.id ? workout.coach_id : workout.athlete_id;
  await createNotification({
    userId: recipientId,
    type: "comment",
    title: "Nouveau commentaire",
    body: `${user.first_name} : ${finalBody.slice(0, 80)}`,
    link: `/workouts/${workoutId}`,
  });
}

// ---------- PROFIL ATHLÈTE ----------

export async function addMeasurementAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const metric = String(formData.get("metric") || "");
  const value = Number(formData.get("value") || 0);
  if (!metric || Number.isNaN(value)) return;

  await dbRun(`INSERT INTO athlete_measurements (id, athlete_id, metric, value) VALUES (?, ?, ?, ?)`, [
    randomUUID(),
    user.id,
    metric,
    value,
  ]);

  revalidatePath("/athlete/profile");
}

export async function addInjuryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const zone = String(formData.get("zone") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const dateStart = String(formData.get("dateStart") || "");
  const dateEnd = String(formData.get("dateEnd") || "");
  if (!zone || !dateStart) return;

  await dbRun(
    `INSERT INTO injuries (id, athlete_id, zone, description, date_start, date_end) VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), user.id, zone, description || null, dateStart, dateEnd || null]
  );

  revalidatePath("/athlete/profile");
}

// ---------- CHARGES DE RÉFÉRENCE (1RM) ----------
// Saisies par le coach à l'issue d'un test — sert à prescrire une charge en
// pourcentage plutôt qu'en kg absolu (cf. StrengthBuilder).

export async function addExerciseMaxAction(athleteId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");
  if (!(await isCoachLinkedToAthlete(user.id, athleteId))) throw new Error("Non autorisé.");

  const exerciseName = String(formData.get("exerciseName") || "").trim();
  const valueKg = Number(formData.get("valueKg") || 0);
  const testedAt = String(formData.get("testedAt") || "");
  if (!exerciseName || !valueKg || !testedAt) throw new Error("Exercice, charge et date requis.");

  await dbRun(`INSERT INTO exercise_maxes (id, athlete_id, exercise_name, value_kg, tested_at) VALUES (?, ?, ?, ?, ?)`, [
    randomUUID(),
    athleteId,
    exerciseName,
    valueKg,
    testedAt,
  ]);

  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath(`/coach/athletes/${athleteId}/new-workout`);
}

export async function deleteExerciseMaxAction(id: string, athleteId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");
  if (!(await isCoachLinkedToAthlete(user.id, athleteId))) throw new Error("Non autorisé.");

  await dbRun(`DELETE FROM exercise_maxes WHERE id = ? AND athlete_id = ?`, [id, athleteId]);
  revalidatePath(`/coach/athletes/${athleteId}`);
}

export async function addJournalEntryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const entryDate = String(formData.get("entryDate") || "");
  const content = String(formData.get("content") || "").trim();
  if (!entryDate || !content) return;

  await dbRun(`INSERT INTO journal_entries (id, athlete_id, entry_date, content) VALUES (?, ?, ?, ?)`, [
    randomUUID(),
    user.id,
    entryDate,
    content,
  ]);

  revalidatePath("/athlete"); // le journal s'affiche sur /athlete, pas /athlete/profile (bug corrigé au passage)
}

export async function updateJournalEntryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const entryId = String(formData.get("entryId") || "");
  const entryDate = String(formData.get("entryDate") || "");
  const content = String(formData.get("content") || "").trim();
  if (!entryId || !entryDate || !content) return;

  // Règle de permission : une entrée ne peut être modifiée que par l'athlète à qui elle appartient.
  const entry = await dbGet<any>(`SELECT athlete_id FROM journal_entries WHERE id = ?`, [entryId]);
  if (!entry || entry.athlete_id !== user.id) throw new Error("Non autorisé.");

  await dbRun(`UPDATE journal_entries SET entry_date = ?, content = ? WHERE id = ?`, [entryDate, content, entryId]);

  revalidatePath("/athlete");
}

export async function deleteJournalEntryAction(entryId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const entry = await dbGet<any>(`SELECT athlete_id FROM journal_entries WHERE id = ?`, [entryId]);
  if (!entry) return;
  if (entry.athlete_id !== user.id) throw new Error("Non autorisé.");

  await dbRun(`DELETE FROM journal_entries WHERE id = ?`, [entryId]);

  revalidatePath("/athlete");
}

// ---------- SÉCURITÉ DES COMPTES (consolidation) ----------

// NOTE PROTOTYPE : en production, l'envoi du lien se fait par email (ex. Resend/SES).
// Ici, le lien est simplement affiché à l'écran pour rester testable sans service d'email.
export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const user = await findUserByEmail(email);
  if (!user) {
    // Toujours répondre pareil, qu'un compte existe ou non, pour ne pas révéler
    // quelles adresses sont enregistrées (bonne pratique de sécurité).
    return { message: "Si un compte existe avec cet email, un lien de réinitialisation a été généré." };
  }
  const token = await createPasswordResetToken(user.id);
  return {
    message: "Lien de réinitialisation généré (affiché ci-dessous car aucun service d'email n'est branché dans ce prototype).",
    resetLink: `/reset-password/${token}`,
  };
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };

  const userId = await consumePasswordResetToken(token);
  if (!userId) return { error: "Ce lien de réinitialisation est invalide ou a expiré." };

  await updateUserPassword(userId, password);
  redirect("/login");
}

export async function logoutAllSessionsAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");
  await destroyAllSessionsForUser(user.id);
  redirect("/login");
}

// ---------- RGPD (consolidation, cf. prompt : export en libre-service + effacement) ----------

export async function deleteMyAccountAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");
  // Les clés étrangères ON DELETE CASCADE nettoient séances, mesures, blessures,
  // journal, liens coach-athlète, cycle, etc. — cf. schéma dans db.ts.
  await dbRun(`DELETE FROM users WHERE id = ?`, [user.id]);
  await destroySession();
  redirect("/login");
}

// ---------- CYCLE MENSTRUEL PARTAGÉ (différenciateur produit prioritaire) ----------

export async function updateCycleSharingAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const share = formData.get("share") === "on";
  const avgCycle = Number(formData.get("averageCycleLength") || 28);
  const avgPeriod = Number(formData.get("averagePeriodLength") || 5);

  const existing = await dbGet(`SELECT * FROM cycle_sharing_settings WHERE athlete_id = ?`, [user.id]);
  if (existing) {
    await dbRun(
      `UPDATE cycle_sharing_settings SET share_with_coaches = ?, average_cycle_length_days = ?, average_period_length_days = ?, consent_given_at = ?
       WHERE athlete_id = ?`,
      [share ? 1 : 0, avgCycle, avgPeriod, share ? new Date().toISOString() : null, user.id]
    );
  } else {
    await dbRun(
      `INSERT INTO cycle_sharing_settings (athlete_id, share_with_coaches, average_cycle_length_days, average_period_length_days, consent_given_at)
       VALUES (?, ?, ?, ?, ?)`,
      [user.id, share ? 1 : 0, avgCycle, avgPeriod, share ? new Date().toISOString() : null]
    );
  }

  revalidatePath("/athlete/profile");
  revalidatePath("/coach");
}

export async function addCycleEntryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const entryDate = String(formData.get("entryDate") || "");
  const entryType = String(formData.get("entryType") || "period_start");
  const notes = String(formData.get("notes") || "").trim();
  if (!entryDate) return;

  await dbRun(`INSERT INTO cycle_entries (id, athlete_id, entry_date, entry_type, notes) VALUES (?, ?, ?, ?, ?)`, [
    randomUUID(),
    user.id,
    entryDate,
    entryType,
    notes || null,
  ]);

  revalidatePath("/athlete/profile");
  revalidatePath("/coach");
}

// ---------- SYNCHRONISATION EXTERNE (résilience Garmin/Strava, cf. prompt) ----------

// NOTE PROTOTYPE : ce prototype n'effectue pas de vrai flux OAuth2 Garmin/Strava — cela
// suppose des identifiants d'API que le porteur du projet doit obtenir auprès de Garmin
// et Strava, et configurer en variables d'environnement (GARMIN_CLIENT_ID / STRAVA_CLIENT_ID).
// La structure de données et l'affichage du statut sont en place pour brancher le vrai
// flux OAuth ensuite, sans changement de schéma. En attendant, le statut renvoyé est
// honnête ("non configuré") plutôt que de simuler une connexion qui n'existe pas —
// cf. prompt : "ne jamais laisser un échec de sync silencieux".
export async function connectProviderAction(provider: "garmin" | "strava") {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const envKey = provider === "garmin" ? "GARMIN_CLIENT_ID" : "STRAVA_CLIENT_ID";
  const configured = !!process.env[envKey];

  if (!configured) {
    await dbRun(
      `INSERT INTO external_connections (id, athlete_id, provider, status, last_error)
       VALUES (?, ?, ?, 'error', ?)
       ON CONFLICT(athlete_id, provider) DO UPDATE SET status = 'error', last_error = excluded.last_error`,
      [
        randomUUID(),
        user.id,
        provider,
        `Connexion à ${provider === "garmin" ? "Garmin" : "Strava"} non configurée sur ce serveur (identifiants d'API manquants).`,
      ]
    );
    revalidatePath("/athlete/profile");
    return { error: `La connexion à ${provider === "garmin" ? "Garmin" : "Strava"} n'est pas encore configurée sur ce serveur.` };
  }

  // Chemin réservé au vrai flux OAuth une fois les identifiants configurés côté serveur.
  redirect(`/api/oauth/${provider}/start`);
}

export async function disconnectProviderAction(provider: "garmin" | "strava") {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  await dbRun(`UPDATE external_connections SET status = 'disconnected', last_error = NULL WHERE athlete_id = ? AND provider = ?`, [
    user.id,
    provider,
  ]);

  revalidatePath("/athlete/profile");
}

// Trace GPS facultative jointe à un import manuel — jamais bloquant : un GPX
// illisible ou absent laisse simplement route_points à null plutôt que de
// faire échouer tout l'enregistrement de l'activité.
async function extractRoutePoints(formData: FormData): Promise<string | null> {
  const file = formData.get("gpxFile") as File | null;
  if (!file || file.size === 0) return null;
  try {
    const points = simplifyRoute(parseGpx(await file.text()));
    return points.length >= 2 ? JSON.stringify(points) : null;
  } catch {
    return null;
  }
}

// Import manuel — filet de sécurité indépendant de toute API tierce (cf. prompt).
// Sert aussi de secours si Garmin ou Strava change ses conditions d'accès.
export async function addImportedActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const activityDate = String(formData.get("activityDate") || "");
  const activityTime = String(formData.get("activityTime") || "").trim();
  const sport = String(formData.get("sport") || "");
  const durationMinutes = formData.get("durationMinutes") ? Number(formData.get("durationMinutes")) : null;
  const distanceKm = formData.get("distanceKm") ? Number(formData.get("distanceKm")) : null;
  const avgHr = formData.get("avgHr") ? Number(formData.get("avgHr")) : null;
  const elevationGainM = formData.get("elevationGainM") ? Number(formData.get("elevationGainM")) : null;
  const avgPowerW = formData.get("avgPowerW") ? Number(formData.get("avgPowerW")) : null;
  const rpe = formData.get("rpe") ? Number(formData.get("rpe")) : null;
  const notes = String(formData.get("notes") || "").trim();
  if (!activityDate || !sport) return;
  const routePoints = await extractRoutePoints(formData);

  await dbRun(
    `INSERT INTO imported_activities (id, athlete_id, source, activity_date, activity_time, sport, duration_minutes, distance_km, avg_hr, elevation_gain_m, avg_power_w, rpe, notes, route_points)
     VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      user.id,
      activityDate,
      activityTime || null,
      sport,
      durationMinutes,
      distanceKm,
      avgHr,
      elevationGainM,
      avgPowerW,
      rpe,
      notes || null,
      routePoints,
    ]
  );

  revalidatePath("/athlete/profile");
  revalidatePath("/athlete");
  revalidatePath(`/athlete/day/${activityDate}`);
}

export async function updateImportedActivityAction(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const existing = await dbGet<any>(`SELECT athlete_id, activity_date, route_points FROM imported_activities WHERE id = ?`, [id]);
  if (!existing || existing.athlete_id !== user.id) throw new Error("Non autorisé.");

  const activityDate = String(formData.get("activityDate") || "");
  const activityTime = String(formData.get("activityTime") || "").trim();
  const sport = String(formData.get("sport") || "");
  const durationMinutes = formData.get("durationMinutes") ? Number(formData.get("durationMinutes")) : null;
  const distanceKm = formData.get("distanceKm") ? Number(formData.get("distanceKm")) : null;
  const avgHr = formData.get("avgHr") ? Number(formData.get("avgHr")) : null;
  const elevationGainM = formData.get("elevationGainM") ? Number(formData.get("elevationGainM")) : null;
  const avgPowerW = formData.get("avgPowerW") ? Number(formData.get("avgPowerW")) : null;
  const rpe = formData.get("rpe") ? Number(formData.get("rpe")) : null;
  const notes = String(formData.get("notes") || "").trim();
  if (!activityDate || !sport) throw new Error("Date et sport requis.");
  // Un nouveau GPX remplace l'ancien tracé ; sans nouveau fichier, on garde
  // celui déjà enregistré plutôt que de l'effacer silencieusement.
  const routePoints = (await extractRoutePoints(formData)) ?? existing.route_points ?? null;

  await dbRun(
    `UPDATE imported_activities SET activity_date = ?, activity_time = ?, sport = ?, duration_minutes = ?, distance_km = ?, avg_hr = ?, elevation_gain_m = ?, avg_power_w = ?, rpe = ?, notes = ?, route_points = ?
     WHERE id = ?`,
    [activityDate, activityTime || null, sport, durationMinutes, distanceKm, avgHr, elevationGainM, avgPowerW, rpe, notes || null, routePoints, id]
  );

  revalidatePath("/athlete/profile");
  revalidatePath("/athlete");
  revalidatePath(`/athlete/day/${activityDate}`);
  if (activityDate !== existing.activity_date) revalidatePath(`/athlete/day/${existing.activity_date}`);
}

export async function deleteImportedActivityAction(id: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const existing = await dbGet<any>(`SELECT athlete_id, activity_date FROM imported_activities WHERE id = ?`, [id]);
  if (!existing || existing.athlete_id !== user.id) throw new Error("Non autorisé.");

  await dbRun(`DELETE FROM imported_activities WHERE id = ?`, [id]);

  revalidatePath("/athlete/profile");
  revalidatePath("/athlete");
  revalidatePath(`/athlete/day/${existing.activity_date}`);
}

// ---------- INDISPONIBILITÉS PERSONNELLES DE L'ATHLÈTE ----------
// L'athlète pose lui-même ses créneaux indisponibles (rendez-vous, obligations
// personnelles...) ; visibles par ses coachs actifs pour planifier les séances
// autour plutôt qu'en plein dessus — pas de bascule de partage séparée ici,
// contrairement au cycle menstruel : il ne s'agit pas d'une donnée de santé.
const VALID_TIME_OF_DAY = ["morning", "midday", "afternoon", "evening", "full_day"];

// Une même indisponibilité peut couvrir plusieurs jours d'affilée (sélecteur
// de plage façon Booking, comme pour la création de séance côté coach) — un
// enregistrement par jour, pour rester modifiable/supprimable jour par jour
// ensuite plutôt que comme un bloc figé.
export async function addAvailabilityBlockAction(params: { dates: string[]; timeOfDay: string; reason?: string }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");
  if (!params.dates.length || !VALID_TIME_OF_DAY.includes(params.timeOfDay)) {
    throw new Error("Choisissez au moins un jour et un créneau.");
  }
  const reason = params.reason?.trim() || null;

  await Promise.all(
    params.dates.map((date) =>
      dbRun(`INSERT INTO availability_blocks (id, athlete_id, date, time_of_day, reason) VALUES (?, ?, ?, ?, ?)`, [
        randomUUID(),
        user.id,
        date,
        params.timeOfDay,
        reason,
      ])
    )
  );

  revalidatePath("/athlete/programmation");
  revalidatePath("/athlete");
  for (const date of params.dates) revalidatePath(`/athlete/day/${date}`);
}

export async function updateAvailabilityBlockAction(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");

  const existing = await dbGet<any>(`SELECT athlete_id, date FROM availability_blocks WHERE id = ?`, [id]);
  if (!existing || existing.athlete_id !== user.id) throw new Error("Non autorisé.");

  const date = String(formData.get("date") || "");
  const timeOfDay = String(formData.get("timeOfDay") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!date || !VALID_TIME_OF_DAY.includes(timeOfDay)) throw new Error("Choisissez un jour et un créneau.");

  await dbRun(`UPDATE availability_blocks SET date = ?, time_of_day = ?, reason = ? WHERE id = ?`, [
    date,
    timeOfDay,
    reason || null,
    id,
  ]);

  revalidatePath("/athlete/programmation");
  revalidatePath("/athlete");
  revalidatePath(`/athlete/day/${date}`);
  if (date !== existing.date) revalidatePath(`/athlete/day/${existing.date}`);
}

export async function deleteAvailabilityBlockAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");

  const block = await dbGet<any>(`SELECT athlete_id, date FROM availability_blocks WHERE id = ?`, [id]);
  if (!block || block.athlete_id !== user.id) throw new Error("Non autorisé.");

  await dbRun(`DELETE FROM availability_blocks WHERE id = ?`, [id]);

  revalidatePath("/athlete/programmation");
  revalidatePath("/athlete");
  revalidatePath(`/athlete/day/${block.date}`);
}

// ---------- BIBLIOTHÈQUE DE RESSOURCES (vidéos, photos, matériel) ----------
// Le coach dépose lui-même ses propres documents (cf. demande explicite).
// Chaque coach ne voit et ne gère que ses propres ressources.

export async function uploadResourceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");

  const type = String(formData.get("type") || "") as "video" | "photo" | "equipment";
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const sport = String(formData.get("sport") || "").trim();
  const file = formData.get("file") as File | null;

  if (!title || !type) return { error: "Le titre et le type sont obligatoires." };

  // Le matériel peut être ajouté sans fichier (une simple fiche) ; vidéo/photo en requièrent un.
  if ((type === "video" || type === "photo") && (!file || file.size === 0)) {
    return { error: "Merci de sélectionner un fichier à déposer." };
  }

  let filePath: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { error: `Fichier trop volumineux (limite : ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} Mo).` };
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { error: `Format non supporté (${file.type || "inconnu"}). Formats acceptés : images et vidéos courantes.` };
    }
    const saved = await saveUploadedFile(file);
    filePath = saved.storedName;
    mimeType = file.type;
    fileSize = saved.size;
  }

  await dbRun(
    `INSERT INTO resources (id, coach_id, type, title, description, sport, file_path, mime_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), user.id, type, title, description || null, sport || null, filePath, mimeType, fileSize]
  );

  revalidatePath("/coach/resources");
  return { success: true };
}

export async function deleteResourceAction(resourceId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");

  const resource = await getResourceById(resourceId);
  if (!resource) return;
  if (resource.coach_id !== user.id) throw new Error("Non autorisé."); // règle de permission critique, cf. suite du projet

  if (resource.file_path) await deleteUploadedFile(resource.file_path);
  await dbRun(`DELETE FROM resources WHERE id = ?`, [resourceId]);

  revalidatePath("/coach/resources");
}

// ---------- NOTIFICATIONS ----------

export async function markNotificationReadAction(notificationId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");
  await markNotificationRead(notificationId, user.id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");
  await markAllNotificationsRead(user.id);
  revalidatePath("/", "layout");
}

export async function subscribePushAction(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");
  await saveSubscription(user.id, subscription);
}

export async function unsubscribePushAction(endpoint: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");
  await removeSubscription(endpoint);
}

// ---------- INFORMATIONS GÉNÉRALES DU PROFIL ----------

// Le genre conditionne l'accès aux fonctionnalités de cycle menstruel (cf. demande :
// visibles uniquement sur les profils renseignés en genre féminin). Champ à part,
// modifiable à tout moment depuis le profil — pas de choix figé à l'inscription,
// cohérent avec l'onboarding progressif déjà en place sur le reste du profil.
export async function setGenderAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const gender = String(formData.get("gender") || "");
  const allowed = ["female", "male", "other", "prefer_not_to_say"];
  if (!allowed.includes(gender)) return;

  await dbRun(`UPDATE users SET gender = ? WHERE id = ?`, [gender, user.id]);
  revalidatePath("/athlete/profile");
}

// ---------- CHECK-IN QUOTIDIEN DE FORME (V2) ----------

export async function upsertCheckinAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const checkDate = String(formData.get("checkDate") || todayISO());
  const physicalLevel = Number(formData.get("physicalLevel") || 5);
  const mentalLevel = Number(formData.get("mentalLevel") || 5);
  const sleepQuality = Number(formData.get("sleepQuality") || 5);
  const soreness = Number(formData.get("soreness") || 5);
  const stress = Number(formData.get("stress") || 5);
  const notes = String(formData.get("notes") || "").trim();

  const clamp = (n: number) => Math.min(10, Math.max(1, Math.round(n)));

  await dbRun(
    `INSERT INTO daily_checkins (id, athlete_id, check_date, physical_level, mental_level, sleep_quality, soreness, stress, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(athlete_id, check_date) DO UPDATE SET
       physical_level = excluded.physical_level,
       mental_level = excluded.mental_level,
       sleep_quality = excluded.sleep_quality,
       soreness = excluded.soreness,
       stress = excluded.stress,
       notes = excluded.notes,
       updated_at = datetime('now')`,
    [randomUUID(), user.id, checkDate, clamp(physicalLevel), clamp(mentalLevel), clamp(sleepQuality), clamp(soreness), clamp(stress), notes || null]
  );

  revalidatePath("/athlete");
  revalidatePath(`/coach/athletes/${user.id}`);
}

// ---------- PHOTO DE PROFIL (V3) ----------

export async function uploadAvatarAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Merci de sélectionner une photo." };
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: `Fichier trop volumineux (limite : ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} Mo).` };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type) || file.type.startsWith("video/")) {
    return { error: "Seules les images sont acceptées pour la photo de profil." };
  }

  // Remplace l'ancienne photo si elle existe, pour ne pas accumuler de fichiers orphelins.
  const previous = await dbGet<any>(`SELECT avatar_path FROM users WHERE id = ?`, [user.id]);
  if (previous?.avatar_path) await deleteUploadedFile(previous.avatar_path);

  const saved = await saveUploadedFile(file);
  await dbRun(`UPDATE users SET avatar_path = ?, avatar_mime_type = ? WHERE id = ?`, [saved.storedName, file.type, user.id]);

  revalidatePath("/athlete/profile");
  revalidatePath("/coach");
}

export async function deleteAvatarAction() {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const row = await dbGet<any>(`SELECT avatar_path FROM users WHERE id = ?`, [user.id]);
  if (row?.avatar_path) await deleteUploadedFile(row.avatar_path);
  await dbRun(`UPDATE users SET avatar_path = NULL WHERE id = ?`, [user.id]);

  revalidatePath("/athlete/profile");
  revalidatePath("/coach");
}

// ---------- MESSAGERIE COACH <-> ATHLÈTE (V3) ----------

// Annonce envoyée en une fois à tous les athlètes actifs du coach (ex. "séance
// annulée demain, trop de vent") — une ligne par fil de discussion existant,
// pas de table séparée : chaque athlète la voit dans son fil habituel avec ce
// coach, comme un message individuel ordinaire.
export async function sendBroadcastMessageAction(body: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "coach") throw new Error("Non autorisé.");
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message vide.");

  const links = await dbAll<{ athlete_id: string }>(
    `SELECT athlete_id FROM coach_athlete_links WHERE coach_id = ? AND status = 'active'`,
    [user.id]
  );
  if (links.length === 0) throw new Error("Aucun athlète actif à qui envoyer ce message.");

  await Promise.all(
    links.map(async (l) => {
      await dbRun(`INSERT INTO messages (id, coach_id, athlete_id, sender_id, body) VALUES (?, ?, ?, ?, ?)`, [
        randomUUID(),
        user.id,
        l.athlete_id,
        user.id,
        trimmed,
      ]);
      await createNotification({
        userId: l.athlete_id,
        type: "message",
        title: `Message de ${user.first_name}`,
        body: trimmed.slice(0, 80),
        link: `/athlete/messages/${user.id}`,
      });
    })
  );

  revalidatePath("/coach");
}

export async function sendMessageAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");

  const coachId = String(formData.get("coachId") || "");
  const athleteId = String(formData.get("athleteId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!body) return;

  // Seuls les deux membres d'un lien actif peuvent s'écrire — même garde que pour le
  // reste des échanges coach-athlète.
  const isParticipant = user.id === coachId || user.id === athleteId;
  if (!isParticipant || !(await isCoachLinkedToAthlete(coachId, athleteId))) throw new Error("Non autorisé.");

  await dbRun(`INSERT INTO messages (id, coach_id, athlete_id, sender_id, body) VALUES (?, ?, ?, ?, ?)`, [
    randomUUID(),
    coachId,
    athleteId,
    user.id,
    body,
  ]);

  const recipientId = user.id === coachId ? athleteId : coachId;
  await createNotification({
    userId: recipientId,
    type: "message",
    title: `Message de ${user.first_name}`,
    body: body.slice(0, 80),
    link: user.role === "coach" ? `/athlete/messages/${coachId}` : `/coach/athletes/${athleteId}/messages`,
  });

  revalidatePath(user.role === "coach" ? `/coach/athletes/${athleteId}/messages` : `/athlete/messages/${coachId}`);
}

export async function markMessagesReadAction(coachId: string, athleteId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");
  const isParticipant = user.id === coachId || user.id === athleteId;
  if (!isParticipant) throw new Error("Non autorisé.");

  await dbRun(
    `UPDATE messages SET read_at = datetime('now') WHERE coach_id = ? AND athlete_id = ? AND sender_id != ? AND read_at IS NULL`,
    [coachId, athleteId, user.id]
  );
  // Pas de revalidatePath ici : ces pages sont déjà rendues dynamiquement à
  // chaque requête (non mises en cache), et cette action est appelée en
  // ligne pendant le rendu de la page de conversation — revalidatePath y est
  // interdit par Next.js (uniquement autorisé hors du flux de rendu) et
  // faisait planter toute la messagerie.
}
