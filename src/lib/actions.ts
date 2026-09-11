"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { dbGet, dbRun } from "./db";
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
import { getResourceById } from "./queries";
import { createNotification, markNotificationRead, markAllNotificationsRead } from "./notifications";

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
}

export interface BlockInput {
  block_type: string;
  exercise_name: string;
  notes?: string;
  resource_id?: string;
  sets?: SetInput[];
}

export async function createWorkoutAction(params: {
  athleteId: string;
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
  if (!(await isCoachLinkedToAthlete(user.id, params.athleteId))) {
    throw new Error("Ce coach n'est pas lié à cet athlète.");
  }

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
      params.category === "objectif" || params.category === "evenement" ? params.priority || null : null,
      params.title,
      params.date,
      params.time || null,
      params.durationMinutes || null,
      params.description || null,
      params.color || "#2F6F5E",
    ]
  );

  if (params.sport === "strength" && params.blocks?.length) {
    let idx = 0;
    for (const b of params.blocks) {
      if (!b.exercise_name) continue;
      // Un exercice ne peut pointer que vers une ressource appartenant au coach qui crée la séance
      // (règle de permission, même logique que pour les athlètes liés).
      let resourceId: string | null = null;
      if (b.resource_id) {
        const resource = await dbGet<any>(`SELECT coach_id FROM resources WHERE id = ?`, [b.resource_id]);
        if (resource && resource.coach_id === user.id) resourceId = b.resource_id;
      }
      const blockId = randomUUID();
      await dbRun(
        `INSERT INTO workout_blocks (id, workout_id, block_type, exercise_name, notes, resource_id, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [blockId, workoutId, b.block_type, b.exercise_name, b.notes || null, resourceId, idx]
      );

      let setIdx = 0;
      for (const s of b.sets || []) {
        if (s.reps || s.load) {
          await dbRun(
            `INSERT INTO exercise_sets (id, block_id, set_number, reps, load, order_index) VALUES (?, ?, ?, ?, ?, ?)`,
            [randomUUID(), blockId, setIdx + 1, s.reps || null, s.load || null, setIdx]
          );
        }
        setIdx++;
      }
      idx++;
    }
  }

  revalidatePath(`/coach/athletes/${params.athleteId}`);
  revalidatePath("/athlete");

  await createNotification({
    userId: params.athleteId,
    type: "new_workout",
    title: "Nouvelle séance",
    body: `« ${params.title} » prévue le ${params.date}.`,
    link: `/workouts/${workoutId}`,
  });

  return { workoutId };
}

export async function updateWorkoutStatusAction(params: {
  workoutId: string;
  status: "done" | "not_done" | "partial" | "postponed";
  rpe?: number;
  athleteFeedback?: string;
  actualDurationMinutes?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");

  const workout = await dbGet<any>(`SELECT * FROM workouts WHERE id = ?`, [params.workoutId]);
  if (!workout) throw new Error("Séance introuvable.");
  if (workout.athlete_id !== user.id && workout.coach_id !== user.id) {
    throw new Error("Non autorisé.");
  }

  await dbRun(
    `UPDATE workouts SET status = ?, rpe = ?, athlete_feedback = ?, actual_duration_minutes = ? WHERE id = ?`,
    [params.status, params.rpe ?? null, params.athleteFeedback ?? null, params.actualDurationMinutes ?? null, params.workoutId]
  );

  revalidatePath(`/workouts/${params.workoutId}`);
  revalidatePath("/athlete");
  revalidatePath(`/coach/athletes/${workout.athlete_id}`);
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

export async function addWorkoutCommentAction(workoutId: string, body: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non autorisé.");
  if (!body.trim()) return;

  const workout = await dbGet<any>(`SELECT * FROM workouts WHERE id = ?`, [workoutId]);
  if (!workout) throw new Error("Séance introuvable.");
  if (workout.athlete_id !== user.id && workout.coach_id !== user.id) {
    throw new Error("Non autorisé.");
  }

  await dbRun(`INSERT INTO workout_comments (id, workout_id, author_id, body) VALUES (?, ?, ?, ?)`, [
    randomUUID(),
    workoutId,
    user.id,
    body.trim(),
  ]);

  revalidatePath(`/workouts/${workoutId}`);

  const recipientId = workout.athlete_id === user.id ? workout.coach_id : workout.athlete_id;
  await createNotification({
    userId: recipientId,
    type: "comment",
    title: "Nouveau commentaire",
    body: `${user.first_name} : ${body.trim().slice(0, 80)}`,
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

  revalidatePath("/athlete/profile");
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

// Import manuel — filet de sécurité indépendant de toute API tierce (cf. prompt).
// Sert aussi de secours si Garmin ou Strava change ses conditions d'accès.
export async function addImportedActivityAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || user.role !== "athlete") throw new Error("Non autorisé.");

  const activityDate = String(formData.get("activityDate") || "");
  const sport = String(formData.get("sport") || "");
  const durationMinutes = formData.get("durationMinutes") ? Number(formData.get("durationMinutes")) : null;
  const distanceKm = formData.get("distanceKm") ? Number(formData.get("distanceKm")) : null;
  const avgHr = formData.get("avgHr") ? Number(formData.get("avgHr")) : null;
  const notes = String(formData.get("notes") || "").trim();
  if (!activityDate || !sport) return;

  await dbRun(
    `INSERT INTO imported_activities (id, athlete_id, source, activity_date, sport, duration_minutes, distance_km, avg_hr, notes)
     VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), user.id, activityDate, sport, durationMinutes, distanceKm, avgHr, notes || null]
  );

  revalidatePath("/athlete/profile");
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

  const checkDate = String(formData.get("checkDate") || new Date().toISOString().slice(0, 10));
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

  revalidatePath("/", "layout");
}
