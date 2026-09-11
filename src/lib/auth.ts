import { dbGet, dbRun } from "./db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";

export type Role = "coach" | "athlete";

export interface User {
  id: string;
  email: string;
  role: Role;
  first_name: string;
  last_name: string;
}

const SESSION_COOKIE = "session_token";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14; // 14 jours

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export async function createUser(params: {
  email: string;
  password: string;
  role: Role;
  firstName: string;
  lastName: string;
}): Promise<User> {
  const id = randomUUID();
  const passwordHash = hashPassword(params.password);
  await dbRun(
    `INSERT INTO users (id, email, password_hash, role, first_name, last_name)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.email.toLowerCase().trim(), passwordHash, params.role, params.firstName, params.lastName]
  );
  return { id, email: params.email, role: params.role, first_name: params.firstName, last_name: params.lastName };
}

export async function findUserByEmail(email: string): Promise<(User & { password_hash: string }) | undefined> {
  return dbGet(`SELECT id, email, password_hash, role, first_name, last_name FROM users WHERE email = ?`, [
    email.toLowerCase().trim(),
  ]);
}

export async function findUserById(id: string): Promise<User | undefined> {
  return dbGet(`SELECT id, email, role, first_name, last_name FROM users WHERE id = ?`, [id]);
}

// --- Sessions ---
// Sécurité des comptes (cf. prompt) : token opaque côté serveur, cookie httpOnly,
// expiration, et possibilité de déconnexion à distance (suppression des lignes
// app_sessions d'un utilisateur = "déconnecter toutes les sessions").

export async function createSession(userId: string): Promise<string> {
  const token = randomUUID() + randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  await dbRun(`INSERT INTO app_sessions (token, user_id, expires_at) VALUES (?, ?, ?)`, [token, userId, expiresAt]);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await dbRun(`DELETE FROM app_sessions WHERE token = ?`, [token]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await dbRun(`DELETE FROM app_sessions WHERE user_id = ?`, [userId]);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await dbGet<any>(
    `SELECT u.id, u.email, u.role, u.first_name, u.last_name, s.expires_at
     FROM app_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    [token]
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await dbRun(`DELETE FROM app_sessions WHERE token = ?`, [token]);
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    first_name: row.first_name,
    last_name: row.last_name,
  };
}

// --- Permissions ---
// Règle la plus critique du produit (cf. prompt, section "Exploitation et fiabilité") :
// un coach ne doit jamais accéder aux données d'un athlète qui n'est pas activement lié.

export async function isCoachLinkedToAthlete(coachId: string, athleteId: string): Promise<boolean> {
  const row = await dbGet(
    `SELECT 1 as found FROM coach_athlete_links WHERE coach_id = ? AND athlete_id = ? AND status = 'active'`,
    [coachId, athleteId]
  );
  return !!row;
}

// --- Réinitialisation de mot de passe (cf. prompt, section "Sécurité des comptes") ---
// Lien à expiration courte (1h), à usage unique.

const RESET_TOKEN_DURATION_MS = 1000 * 60 * 60; // 1 heure

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION_MS).toISOString();
  await dbRun(`INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`, [
    token,
    userId,
    expiresAt,
  ]);
  return token;
}

export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const row = await dbGet<any>(`SELECT * FROM password_reset_tokens WHERE token = ?`, [token]);
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await dbRun(`UPDATE password_reset_tokens SET used_at = datetime('now') WHERE token = ?`, [token]);
  return row.user_id;
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const hash = hashPassword(newPassword);
  await dbRun(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, userId]);
  // Bonne pratique : un changement de mot de passe invalide toutes les sessions actives.
  await destroyAllSessionsForUser(userId);
}

// --- RGPD : effacement de compte en self-service ---
// La suppression de la ligne "users" entraîne, via les contraintes ON DELETE CASCADE
// du schéma, la suppression de toutes les données qui en dépendent (mesures,
// blessures, journal, séances, commentaires, cycle, activités importées, sessions).
export async function deleteUserAccount(userId: string): Promise<void> {
  await dbRun(`DELETE FROM users WHERE id = ?`, [userId]);
}
