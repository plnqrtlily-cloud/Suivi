import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put, del } from "@vercel/blob";

// Stockage des fichiers uploadés (bibliothèque de ressources, photos de profil) :
// disque local en développement (aucun compte requis, comme la base de données),
// Vercel Blob en production (déploiement Vercel, cf. README "Déploiement en
// ligne"). Le choix se fait automatiquement selon la présence de la variable
// d'environnement BLOB_READ_WRITE_TOKEN — le reste du code applicatif (routes de
// service, permissions) ne change pas selon le mode.

const isBlobEnabled = !!process.env.BLOB_READ_WRITE_TOKEN;
const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Retourne un identifiant de fichier opaque : un nom de fichier local en mode
// disque, l'URL Vercel Blob en mode hébergé. Jamais le nom d'origine (pour éviter
// tout risque de traversée de chemin ou de collision).
export async function saveUploadedFile(file: File): Promise<{ storedName: string; size: number }> {
  const ext = path.extname(file.name).toLowerCase();
  const storedName = `${randomUUID()}${ext}`;

  if (isBlobEnabled) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = await put(storedName, buffer, { access: "public", contentType: file.type });
    // L'URL Blob sert d'identifiant : privée en pratique car jamais exposée
    // directement au client (toujours servie via nos routes /api/... qui
    // vérifient la permission avant de la relayer).
    return { storedName: blob.url, size: buffer.length };
  }

  ensureUploadsDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer);
  return { storedName, size: buffer.length };
}

export async function deleteUploadedFile(storedName: string): Promise<void> {
  if (isBlobEnabled && storedName.startsWith("http")) {
    await del(storedName).catch(() => {
      // Silencieux : un fichier déjà supprimé ou introuvable ne doit pas
      // empêcher la suppression de la ressource elle-même en base.
    });
    return;
  }
  const filePath = path.join(UPLOADS_DIR, storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export async function readUploadedFile(storedName: string): Promise<Buffer | null> {
  if (storedName.startsWith("http")) {
    try {
      const res = await fetch(storedName);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  const filePath = path.join(UPLOADS_DIR, storedName);
  // Garde contre toute tentative de sortir du dossier d'upload (sécurité basique).
  if (!filePath.startsWith(UPLOADS_DIR)) return null;
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}
