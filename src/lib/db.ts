import { createClient, type Client } from "@libsql/client";
import path from "path";
import fs from "fs";

// Base de données : en local (développement), fichier SQLite classique via le
// moteur libSQL embarqué — aucun compte, aucune configuration nécessaire. En
// production (déploiement Vercel), une base Turso distante est utilisée à la
// place (même dialecte SQL, seule l'URL de connexion change). C'est ce qui
// permet à cette app de fonctionner sans rien configurer en local, tout en
// étant réellement déployable en ligne sans dépendre d'un Mac — voir le README,
// section "Déploiement en ligne (Vercel + Turso)".
//
// Migration depuis better-sqlite3 (V3.1 et avant) : le dialecte SQL est
// identique (libSQL est un sur-ensemble compatible de SQLite), seule l'API est
// devenue asynchrone (obligatoire pour parler à une base distante). Les
// fonctions dbGet/dbAll/dbRun ci-dessous remplacent mécaniquement
// db.prepare(sql).get/all/run(...args) par await dbGet/dbAll/dbRun(sql, [...args]).

const isRemote = !!process.env.TURSO_DATABASE_URL;

let url: string;
if (isRemote) {
  url = process.env.TURSO_DATABASE_URL!;
} else {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  url = `file:${path.join(dataDir, "app.db")}`;
}

const client: Client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('coach','athlete')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('female','male','other','prefer_not_to_say')),
  avatar_path TEXT,
  avatar_mime_type TEXT,
  accepted_terms_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sécurité des comptes : réinitialisation de mot de passe par lien à expiration courte
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lien coach <-> athlète, avec flux d'invitation (cf. prompt : "Flux d'invitation/liaison")
CREATE TABLE IF NOT EXISTS coach_athlete_links (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  invite_email TEXT,
  invite_token TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','active','revoked')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT
);

-- Séances / entraînements (cf. prompt : "Création d'entraînement")
CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport TEXT NOT NULL CHECK (sport IN ('running','cycling','hiking','swimming','climbing','strength','other')),
  category TEXT NOT NULL DEFAULT 'entrainement' CHECK (category IN ('objectif','evenement','entrainement','divers')),
  priority TEXT CHECK (priority IN ('A','B','C')),
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  duration_minutes INTEGER,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#1B4B4F',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','not_done','partial','postponed')),
  rpe INTEGER,
  athlete_feedback TEXT,
  actual_duration_minutes INTEGER,
  -- Données réellement effectuées, saisies par l'athlète à la validation de la
  -- séance — mêmes champs que l'import manuel, demandés selon le sport (cf.
  -- StatusForm) plutôt que génériques pour tous les sports.
  distance_km REAL,
  avg_hr INTEGER,
  elevation_gain_m INTEGER,
  avg_power_w INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Blocs détaillés pour la musculation (cf. prompt : structuration en blocs)
CREATE TABLE IF NOT EXISTS workout_blocks (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN (
    'warmup_mobility','warmup_plyo','warmup_proprio',
    'main','secondary','complementary','specific',
    'core','cooldown'
  )),
  exercise_name TEXT NOT NULL,
  sets INTEGER,
  reps TEXT,
  load TEXT,
  notes TEXT,
  resource_id TEXT REFERENCES resources(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  -- Qualité physique travaillée par ce bloc (force max / explosivité / force-
  -- endurance / cardio) : détermine quels champs le coach renseigne par série
  -- (cf. exercise_sets.rest_seconds/rpe) et comment l'athlète doit exécuter
  -- l'exercice — un bloc "force max" et un bloc "cardio" ne se lisent pas pareil.
  training_quality TEXT CHECK (training_quality IN ('force_max','explosivite','force_endurance','cardio'))
);

-- Fil de commentaires par séance (cf. prompt : "Communication")
CREATE TABLE IF NOT EXISTS workout_comments (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  -- Vidéo d'exécution jointe par l'athlète (ou vidéo de correction par le
  -- coach) — mêmes contraintes de format/taille que la bibliothèque de
  -- ressources (cf. src/lib/storage.ts), stockage identique.
  video_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mesures physiologiques dans le temps (cf. prompt : "avec historique dans le temps")
CREATE TABLE IF NOT EXISTS athlete_measurements (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('weight_kg','fc_repos','fc_max','vo2max','ftp','pma_vma','height_cm')),
  value REAL NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Modèles de séance réutilisables par le coach (cf. prompt : gagner le temps
-- perdu à recréer la même structure de séance semaine après semaine ou
-- athlète après athlète). Les blocs de musculation sont stockés en JSON
-- plutôt que relationnellement : un modèle n'est jamais lié à un workout_id,
-- inutile de dupliquer tout le schéma workout_blocks/exercise_sets pour ça.
CREATE TABLE IF NOT EXISTS workout_templates (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sport TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'entrainement',
  duration_minutes INTEGER,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#1B4B4F',
  blocks_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Charges de référence (1RM ou équivalent) par exercice, saisies par le coach
-- à l'issue d'un test — permet de prescrire une charge en % plutôt qu'en kg
-- absolu, et de suivre la progression d'un max dans le temps (contrairement
-- au champ "load" en texte libre de exercise_sets, qui décrit une charge
-- prescrite pour une séance donnée, pas un repère testé).
CREATE TABLE IF NOT EXISTS exercise_maxes (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  value_kg REAL NOT NULL,
  tested_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Antécédents de blessures
CREATE TABLE IF NOT EXISTS injuries (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  zone TEXT NOT NULL,
  description TEXT,
  date_start TEXT NOT NULL,
  date_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Journal de bord
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cycle menstruel partagé (différenciateur produit prioritaire, cf. étude de marché).
-- Partage explicite et séparé du consentement de compte (RGPD, donnée de santé Art. 9) :
-- désactivé par défaut, l'athlète l'active elle-même.
CREATE TABLE IF NOT EXISTS cycle_entries (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('period_start','period_end','symptom_note')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cycle_sharing_settings (
  athlete_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  share_with_coaches INTEGER NOT NULL DEFAULT 0,
  average_cycle_length_days INTEGER NOT NULL DEFAULT 28,
  average_period_length_days INTEGER NOT NULL DEFAULT 5,
  consent_given_at TEXT
);

-- Connexions à des plateformes externes (cf. prompt : résilience Garmin/Strava —
-- "ne pas coder l'architecture comme dépendante d'une seule source" + "statut de
-- synchronisation toujours visible, jamais d'échec silencieux").
CREATE TABLE IF NOT EXISTS external_connections (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('garmin','strava')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','connected','error')),
  last_sync_at TEXT,
  last_error TEXT,
  UNIQUE(athlete_id, provider)
);

-- Activités : import manuel (filet de sécurité indépendant de toute API tierce,
-- cf. prompt) et, plus tard, activités synchronisées automatiquement (même table,
-- "source" distingue l'origine).
CREATE TABLE IF NOT EXISTS imported_activities (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id TEXT REFERENCES workouts(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('manual','garmin','strava')),
  activity_date TEXT NOT NULL,
  activity_time TEXT,
  sport TEXT NOT NULL,
  duration_minutes INTEGER,
  distance_km REAL,
  avg_hr INTEGER,
  -- Dénivelé (rando/vélo/course), puissance moyenne (vélo) et RPE ressenti :
  -- sans RPE une activité importée ne comptait pour rien dans le bilan de
  -- charge, alors qu'elle représente un vrai entraînement pour l'athlète.
  elevation_gain_m INTEGER,
  avg_power_w INTEGER,
  rpe INTEGER,
  notes TEXT,
  -- Trace GPS d'un import GPX manuel : tableau JSON de {lat,lng}, sous-
  -- échantillonné à l'import (cf. src/lib/gpx.ts) — jamais le fichier GPX
  -- brut, pour rester léger à lire/afficher.
  route_points TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Bibliothèque de ressources du coach (cf. prompt : "Base de données : Vidéos, Tests
-- physiques, Photos, Matériel"). Le coach dépose lui-même ses propres documents.
-- Le fichier réel est stocké sur disque (data/uploads/...), cette table n'en garde
-- que les métadonnées + le chemin relatif.
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video','photo','equipment')),
  title TEXT NOT NULL,
  description TEXT,
  sport TEXT,
  file_path TEXT,
  mime_type TEXT,
  file_size INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Notifications in-app (cf. prompt : nouvelle séance envoyée, séance modifiée/annulée,
-- message reçu, rappel avant une compétition). Email/push nécessiteraient un service
-- externe (Resend, Web Push) non disponible dans ce prototype — voir README.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_workout','workout_cancelled','workout_updated','comment','event_reminder','message')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Abonnements Web Push (notifications système, hors app) — un utilisateur peut
-- avoir plusieurs abonnements (plusieurs appareils/navigateurs), identifiés
-- chacun par leur endpoint unique côté navigateur.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Check-in quotidien de forme (cf. demande V2 : niveau physique/psychologique et
-- variables importantes pour un "global" du jour). Un seul check-in par athlète et
-- par jour (UNIQUE) : l'athlète peut l'ajuster plusieurs fois dans la journée, la
-- dernière valeur écrase la précédente plutôt que d'empiler des doublons.
CREATE TABLE IF NOT EXISTS daily_checkins (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_date TEXT NOT NULL,
  physical_level INTEGER NOT NULL CHECK (physical_level BETWEEN 1 AND 10),
  mental_level INTEGER NOT NULL CHECK (mental_level BETWEEN 1 AND 10),
  sleep_quality INTEGER NOT NULL CHECK (sleep_quality BETWEEN 1 AND 10),
  soreness INTEGER NOT NULL CHECK (soreness BETWEEN 1 AND 10),
  stress INTEGER NOT NULL CHECK (stress BETWEEN 1 AND 10),
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(athlete_id, check_date)
);
-- Séries détaillées par exercice (cf. V2.2 : inspiré des meilleures apps de suivi de
-- musculation type Strong/Hevy — chaque série a ses propres répétitions/charge,
-- plutôt qu'un seul champ "séries" global, pour permettre des séries pyramidales,
-- des montées en charge progressives, etc. Remplace l'usage des anciennes colonnes
-- sets/reps/load de workout_blocks pour les nouvelles séances (conservées pour
-- compatibilité avec des données existantes).
CREATE TABLE IF NOT EXISTS exercise_sets (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES workout_blocks(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps TEXT,
  load TEXT,
  rest_seconds INTEGER,
  rpe INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0
);
-- Indisponibilités personnelles de l'athlète (rendez-vous, obligations...),
-- par créneau de la journée plutôt qu'horaire précis — l'athlète les pose
-- lui-même sur son calendrier, le coach les voit pour planifier ses séances
-- autour plutôt qu'en plein dessus.
CREATE TABLE IF NOT EXISTS availability_blocks (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time_of_day TEXT NOT NULL CHECK (time_of_day IN ('morning','midday','afternoon','evening','full_day')),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Discussion coach <-> athlète, indépendante d'une séance précise (cf. demande V3 :
-- fonctionnalité de discussion). Scindée par paire coach/athlète puisqu'un athlète
-- peut avoir plusieurs coachs et un coach plusieurs athlètes.
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notes privées d'un coach sur un athlète (points forts/faibles, axes de
-- travail) — jamais visibles par l'athlète, ni par un autre coach du même
-- athlète : propres au coach qui les écrit. Une ligne par paire coach/athlète,
-- mise à jour sur place plutôt qu'un historique d'entrées séparées.
CREATE TABLE IF NOT EXISTS coach_athlete_notes (
  coach_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strengths TEXT,
  weaknesses TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (coach_id, athlete_id)
);
`;

let initialized: Promise<void> | null = null;

// Migrations légères pour les bases déjà déployées (locales et Turso) : la base
// existante n'a pas cette colonne (elle n'existait pas au moment où la table a été
// créée), donc CREATE TABLE IF NOT EXISTS ne suffit pas — il faut l'ajouter
// explicitement. Sans risque pour les données déjà enregistrées : ALTER TABLE ADD
// COLUMN ne touche à aucune ligne existante, il ajoute juste la colonne (vide) en
// plus. Échoue silencieusement si la colonne existe déjà (base neuve ou migration
// déjà appliquée), ce qui la rend sûre à ré-exécuter à chaque démarrage.
const MIGRATIONS: string[] = [
  // Charges de référence : type de variable (charge/temps/répétitions, façon
  // Garmin qui distingue durée et répétitions) + note libre. "value_kg" reste
  // le nom de colonne pour des raisons historiques mais porte désormais la
  // valeur numérique dans l'unité pertinente (kg, secondes, ou répétitions).
  `ALTER TABLE exercise_maxes ADD COLUMN value_type TEXT DEFAULT 'charge'`,
  `ALTER TABLE exercise_maxes ADD COLUMN note TEXT`,
  // Statistiques de performance : note libre, comme pour les charges de référence.
  `ALTER TABLE athlete_measurements ADD COLUMN note TEXT`,
  // Liens utiles ajoutés à la construction d'une séance (plan d'entraînement
  // externe, vidéo, carte de parcours…) — stockés en JSON (tableau de
  // {label, url}), comme les modèles de séances.
  `ALTER TABLE workouts ADD COLUMN links_json TEXT`,
  `ALTER TABLE imported_activities ADD COLUMN activity_time TEXT`,
  `ALTER TABLE imported_activities ADD COLUMN elevation_gain_m INTEGER`,
  `ALTER TABLE imported_activities ADD COLUMN avg_power_w INTEGER`,
  `ALTER TABLE imported_activities ADD COLUMN rpe INTEGER`,
  `ALTER TABLE workout_blocks ADD COLUMN training_quality TEXT`,
  `ALTER TABLE exercise_sets ADD COLUMN rest_seconds INTEGER`,
  `ALTER TABLE exercise_sets ADD COLUMN rpe INTEGER`,
  `ALTER TABLE imported_activities ADD COLUMN route_points TEXT`,
  `ALTER TABLE workouts ADD COLUMN distance_km REAL`,
  `ALTER TABLE workout_blocks ADD COLUMN rep_type TEXT DEFAULT 'reps'`,
  `ALTER TABLE workouts ADD COLUMN intervals_json TEXT`,
  `ALTER TABLE workout_blocks ADD COLUMN circuit_id TEXT`,
  `ALTER TABLE workout_blocks ADD COLUMN circuit_rounds INTEGER`,
  `ALTER TABLE users ADD COLUMN sports_json TEXT`,
  `ALTER TABLE workouts ADD COLUMN avg_hr INTEGER`,
  `ALTER TABLE workouts ADD COLUMN elevation_gain_m INTEGER`,
  `ALTER TABLE workouts ADD COLUMN avg_power_w INTEGER`,
  `ALTER TABLE workout_comments ADD COLUMN video_path TEXT`,
];

// SQLite ne permet pas de modifier une contrainte CHECK existante par ALTER
// TABLE : quand 'full_day' a été ajouté aux créneaux valides après le premier
// déploiement de availability_blocks, les bases déjà créées avaient la
// contrainte figée sans cette valeur. Reconstruit la table (renommer/copier/
// supprimer) uniquement si nécessaire — vérifié via sqlite_master plutôt
// qu'un indicateur séparé, donc sans risque à rejouer à chaque démarrage.
async function migrateAvailabilityBlocksCheck(): Promise<void> {
  try {
    const info = await client.execute(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='availability_blocks'`
    );
    const ddl = info.rows[0]?.sql as string | undefined;
    if (!ddl || ddl.includes("full_day")) return; // table absente ou déjà migrée
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS availability_blocks_new (
        id TEXT PRIMARY KEY,
        athlete_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        time_of_day TEXT NOT NULL CHECK (time_of_day IN ('morning','midday','afternoon','evening','full_day')),
        reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO availability_blocks_new SELECT * FROM availability_blocks;
      DROP TABLE availability_blocks;
      ALTER TABLE availability_blocks_new RENAME TO availability_blocks;
    `);
  } catch {
    // Best effort — en cas d'échec, la contrainte reste stricte mais aucune donnée n'est perdue.
  }
}

// Même contrainte SQLite qu'au-dessus (CHECK non modifiable par ALTER TABLE) :
// 'workout_updated' a été ajouté aux types de notification après le premier
// déploiement de la table notifications.
async function migrateNotificationsCheck(): Promise<void> {
  try {
    const info = await client.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name='notifications'`);
    const ddl = info.rows[0]?.sql as string | undefined;
    if (!ddl || ddl.includes("workout_updated")) return;
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS notifications_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('new_workout','workout_cancelled','workout_updated','comment','event_reminder','message')),
        title TEXT NOT NULL,
        body TEXT,
        link TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO notifications_new SELECT * FROM notifications;
      DROP TABLE notifications;
      ALTER TABLE notifications_new RENAME TO notifications;
    `);
  } catch {
    // Best effort — en cas d'échec, la contrainte reste stricte mais aucune donnée n'est perdue.
  }
}

async function init(): Promise<void> {
  await client.executeMultiple(SCHEMA_SQL);
  await migrateAvailabilityBlocksCheck();
  await migrateNotificationsCheck();
  for (const migration of MIGRATIONS) {
    try {
      await client.execute(migration);
    } catch {
      // Colonne déjà présente — migration déjà appliquée, rien à faire.
    }
  }
}

// À appeler (et attendre) avant toute requête — memoized, donc le coût
// d'initialisation du schéma n'est payé qu'une seule fois par instance serveur.
export async function ready(): Promise<Client> {
  if (!initialized) initialized = init();
  await initialized;
  return client;
}

export async function dbGet<T = any>(sql: string, args: any[] = []): Promise<T | undefined> {
  const db = await ready();
  const rs = await db.execute({ sql, args });
  const row = rs.rows[0];
  // Les lignes renvoyées par le client libSQL ne sont pas de vrais objets JS
  // (indices numériques + méthodes en plus des colonnes) — on les transforme en
  // objets plain pour pouvoir les passer sans avertissement à un composant client.
  return row === undefined ? undefined : ({ ...(row as any) } as T);
}

export async function dbAll<T = any>(sql: string, args: any[] = []): Promise<T[]> {
  const db = await ready();
  const rs = await db.execute({ sql, args });
  return rs.rows.map((row) => ({ ...(row as any) })) as T[];
}

export interface RunResult {
  rowsAffected: number;
  lastInsertRowid?: bigint;
}

export async function dbRun(sql: string, args: any[] = []): Promise<RunResult> {
  const db = await ready();
  const rs = await db.execute({ sql, args });
  return { rowsAffected: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
}

// Exécute plusieurs requêtes en une seule transaction (utilisé là où l'ancien
// code better-sqlite3 s'appuyait sur l'atomicité implicite de plusieurs
// db.prepare(...).run() synchrones à la suite, ex. suppression en cascade
// manuelle ou insertions liées).
export async function dbBatch(statements: { sql: string; args?: any[] }[]): Promise<void> {
  const db = await ready();
  await db.batch(
    statements.map((s) => ({ sql: s.sql, args: s.args || [] })),
    "write"
  );
}

export default client;
