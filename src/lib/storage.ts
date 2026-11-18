import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { put, del, head } from "@vercel/blob";
import { NextResponse } from "next/server";

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
  // Documents (ex. résultat de test exporté en PDF) — pas de formats bureautiques
  // à macros (Word/Excel) pour ne pas élargir la surface de risque à l'upload.
  "application/pdf",
];

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo

// Documents acceptés en plus dans la messagerie : formats bureautiques SANS
// macros (docx, xlsx, pptx — les variantes à macros ont d'autres types), texte
// et CSV. Toujours servis en téléchargement, jamais affichés dans la page.
export const MESSAGE_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Fichier reçu par une action : soit le fichier lui-même (petit fichier, ou
 * développement local), soit la référence d'un fichier déjà envoyé directement
 * au stockage par le navigateur (cf. src/lib/upload-client.ts).
 */
export type IncomingUpload = { name: string; type: string; size: number; file?: File; blobUrl?: string };

export async function uploadFromForm(formData: FormData, field: string): Promise<IncomingUpload | null> {
  const v = formData.get(field);
  if (v instanceof File) return v.size > 0 ? { name: v.name, type: v.type, size: v.size, file: v } : null;
  if (typeof v !== "string" || !v.startsWith("blobref:") || !isBlobEnabled) return null;
  let ref: { url?: string; name?: string };
  try {
    ref = JSON.parse(v.slice("blobref:".length));
  } catch {
    return null;
  }
  if (!ref.url) return null;
  let host = "";
  try {
    host = new URL(ref.url).hostname;
  } catch {
    return null;
  }
  // Seuls les fichiers de notre stockage, avec leur taille et leur type réels.
  if (!host.endsWith(".blob.vercel-storage.com")) return null;
  const meta = await head(ref.url).catch(() => null);
  if (!meta) return null;
  return { name: String(ref.name || meta.pathname), type: meta.contentType, size: meta.size, blobUrl: meta.url };
}

// Retourne un identifiant de fichier opaque : un nom de fichier local en mode
// disque, l'URL Vercel Blob en mode hébergé. Jamais le nom d'origine (pour éviter
// tout risque de traversée de chemin ou de collision).
export async function saveUploadedFile(input: File | IncomingUpload): Promise<{ storedName: string; size: number }> {
  // Déjà dans le stockage (envoi direct depuis le navigateur).
  if (!(input instanceof File) && input.blobUrl) return { storedName: input.blobUrl, size: input.size };
  const file = input instanceof File ? input : input.file!;
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


/**
 * Fichier du stockage Vercel : après la vérification des droits, on renvoie le
 * navigateur vers le fichier au lieu de le relire et de le retransmettre —
 * plus rapide, et sans la limite de 4,5 Mo d'une réponse de l'app (une vidéo
 * plus lourde ne s'affichait pas). `download` force le téléchargement sous ce nom.
 */
export function blobRedirect(storedName: string | null | undefined, opts: { download?: string } = {}): NextResponse | null {
  if (!storedName || !storedName.startsWith("http")) return null;
  const url = new URL(storedName);
  if (opts.download) url.searchParams.set("download", "1");
  return NextResponse.redirect(url, { status: 307, headers: { "Cache-Control": "private, max-age=300" } });
}
