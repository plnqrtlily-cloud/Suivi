import { dbGet, dbAll, dbRun } from "./db";
import { randomUUID } from "crypto";
import { sendPushToUser } from "./push";

export type NotificationType = "new_workout" | "workout_cancelled" | "workout_updated" | "comment" | "event_reminder" | "message";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  await dbRun(`INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)`, [
    randomUUID(),
    params.userId,
    params.type,
    params.title,
    params.body || null,
    params.link || null,
  ]);

  try {
    await sendPushToUser(params.userId, { title: params.title, body: params.body, url: params.link });
  } catch {
    // Best-effort : la notification in-app existe déjà, un échec du push ne
    // doit jamais remonter jusqu'à l'appelant (création de séance, message…).
  }
}

// Rappel avant une compétition (cf. prompt). Pas de tâche planifiée (cron) dans ce
// prototype : on génère les rappels manquants à chaque consultation des notifications
// par l'athlète, de façon idempotente (un seul rappel par événement, jamais de doublon).
async function generateEventReminders(athleteId: string): Promise<void> {
  const upcoming = await dbAll<any>(
    `SELECT id, title, date FROM workouts
     WHERE athlete_id = ? AND category = 'evenement'
       AND date BETWEEN date('now') AND date('now', '+3 days')`,
    [athleteId]
  );

  for (const event of upcoming) {
    const link = `/workouts/${event.id}`;
    const already = await dbGet(`SELECT 1 as found FROM notifications WHERE user_id = ? AND type = 'event_reminder' AND link = ?`, [
      athleteId,
      link,
    ]);
    if (already) continue;
    await createNotification({
      userId: athleteId,
      type: "event_reminder",
      title: "Événement à venir",
      body: `« ${event.title} » a lieu le ${event.date}.`,
      link,
    });
  }
}

export async function getNotifications(userId: string, limit = 20): Promise<Notification[]> {
  await generateEventReminders(userId); // no-op si l'utilisateur est un coach ou n'a pas d'événement proche
  return dbAll(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`, [userId, limit]);
}

export async function getUnreadCount(userId: string): Promise<number> {
  await generateEventReminders(userId);
  const row = await dbGet<any>(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL`, [
    userId,
  ]);
  return row?.count ?? 0;
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await dbRun(`UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?`, [
    notificationId,
    userId,
  ]);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await dbRun(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`, [userId]);
}
