import webpush from "web-push";
import { dbAll, dbRun } from "./db";

// Notifications système (hors app) via l'API standard Web Push — aucun compte
// tiers requis (contrairement à Firebase Cloud Messaging ou APNs), juste une
// paire de clés VAPID générée une fois pour ce déploiement (cf. README).
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:contact@example.com";

const isConfigured = !!publicKey && !!privateKey;
if (isConfigured) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
}

export function getPushPublicKey(): string | null {
  return publicKey || null;
}

export async function saveSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
  const { randomUUID } = await import("crypto");
  await dbRun(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [randomUUID(), userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await dbRun(`DELETE FROM push_subscriptions WHERE endpoint = ?`, [endpoint]);
}

// Best-effort : jamais d'exception qui remonterait jusqu'à l'appelant
// (createNotification) — un push qui échoue ne doit jamais empêcher la
// notification in-app correspondante d'exister.
export async function sendPushToUser(userId: string, payload: { title: string; body?: string; url?: string }): Promise<void> {
  if (!isConfigured) return;

  const subs = await dbAll<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`,
    [userId]
  );
  if (subs.length === 0) return;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      } catch (err: any) {
        // Abonnement expiré/révoqué côté navigateur : on le retire pour ne pas
        // retenter indéfiniment un envoi voué à l'échec à chaque notification.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await dbRun(`DELETE FROM push_subscriptions WHERE id = ?`, [s.id]);
        }
      }
    })
  );
}
