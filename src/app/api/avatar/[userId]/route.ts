import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isCoachLinkedToAthlete } from "@/lib/auth";
import { getUserAvatar } from "@/lib/queries";
import { readUploadedFile } from "@/lib/storage";

// Sert la photo de profil d'un athlète. Visible par l'athlète lui-même et par ses
// coachs activement liés — jamais par un tiers, même avec l'URL en main.
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { userId } = await params;
  const isSelf = user.id === userId;
  const isLinkedCoach = user.role === "coach" && (await isCoachLinkedToAthlete(user.id, userId));
  if (!isSelf && !isLinkedCoach) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const avatar = await getUserAvatar(userId);
  if (!avatar?.avatar_path) return NextResponse.json({ error: "Pas de photo." }, { status: 404 });

  const buffer = await readUploadedFile(avatar.avatar_path);
  if (!buffer) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": avatar.avatar_mime_type || "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
