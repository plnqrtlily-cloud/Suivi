"use client";

import { upload } from "@vercel/blob/client";

// Les fichiers lourds (vidéo, photo HD…) partent directement du navigateur
// vers le stockage, puis seule leur référence est envoyée à l'action serveur.
// Raison : Vercel limite une requête vers l'app à 4,5 Mo. En local (pas de
// stockage Vercel), le fichier reste envoyé tel quel.
const DIRECT_FROM = 3.5 * 1024 * 1024;
let blobDisabled = false;

export async function withDirectUploads(formData: FormData, fields: string[]): Promise<void> {
  for (const field of fields) {
    const v = formData.get(field);
    if (!(v instanceof File) || v.size < DIRECT_FROM || blobDisabled) continue;
    try {
      const ext = v.name.includes(".") ? v.name.slice(v.name.lastIndexOf(".")).toLowerCase() : "";
      const blob = await upload(`uploads/${crypto.randomUUID()}${ext}`, v, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: v.type || undefined,
      });
      formData.set(field, `blobref:${JSON.stringify({ url: blob.url, name: v.name, type: v.type, size: v.size })}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/disabled|501/.test(msg)) {
        blobDisabled = true; // développement local : envoi classique
        continue;
      }
      throw new Error(msg || "Le fichier n'a pas pu être envoyé. Vérifiez la connexion et réessayez.");
    }
  }
}
