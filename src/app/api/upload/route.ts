import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MESSAGE_DOC_TYPES } from "@/lib/storage";

// Envoi direct d'un fichier du navigateur vers Vercel Blob (cf.
// src/lib/upload-client.ts). Une requête vers l'app est limitée à 4,5 Mo par
// Vercel : une vidéo plus lourde arrivait tronquée (« Unexpected end of form »).
// Ici l'app ne fait que délivrer l'autorisation d'envoi, à un utilisateur
// connecté, pour les types et la taille déjà autorisés.
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "disabled" }, { status: 501 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await getCurrentUser();
        if (!user) throw new Error("Non authentifié.");
        return {
          allowedContentTypes: [...new Set([...ALLOWED_MIME_TYPES, ...MESSAGE_DOC_TYPES])],
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Envoi refusé." }, { status: 400 });
  }
}
