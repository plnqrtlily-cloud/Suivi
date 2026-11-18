import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isCoachLinkedToAthlete } from "@/lib/auth";
import { getResourceById } from "@/lib/queries";
import { readUploadedFile } from "@/lib/storage";
import { bundledAnimationFile } from "@/lib/animation-upgrade";
import { animationUrl } from "@/lib/exercise-animations";
import { createHash } from "crypto";

// Sert le fichier déposé par le coach. Accessible au coach propriétaire, et à ses
// athlètes activement liés (pour qu'ils puissent visionner une vidéo d'exercice
// jointe à une séance) — jamais à un tiers.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const resource = await getResourceById(id);
  if (!resource || !resource.file_path) {
    return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
  }

  const isOwner = resource.coach_id === user.id;
  const isLinkedAthlete = user.role === "athlete" && (await isCoachLinkedToAthlete(resource.coach_id, user.id));
  if (!isOwner && !isLinkedAthlete) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  // Animation livrée avec l'application : servie par le CDN (fichier public).
  const bundled = bundledAnimationFile(resource.file_path);
  if (bundled) return NextResponse.redirect(new URL(animationUrl(bundled), request.url), 307);

  // Le fichier peut changer sous la même adresse (animation refaite, cf.
  // src/lib/animation-upgrade.ts) : le navigateur revalide à chaque affichage
  // et ne retélécharge que si le fichier a changé.
  const etag = `"${createHash("sha1").update(resource.file_path).digest("hex").slice(0, 16)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, no-cache" } });
  }

  const buffer = await readUploadedFile(resource.file_path);
  if (!buffer) return NextResponse.json({ error: "Fichier introuvable sur le serveur." }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": resource.mime_type || "application/octet-stream",
      "Cache-Control": "private, no-cache",
      ETag: etag,
    },
  });
}
