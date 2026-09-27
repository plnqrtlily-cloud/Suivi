import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isCoachLinkedToAthlete } from "@/lib/auth";
import { dbGet } from "@/lib/db";
import { readUploadedFile } from "@/lib/storage";

// Sert la pièce jointe (photo/vidéo/PDF) d'un résultat de test à l'effort —
// accessible au coach qui suit l'athlète et à l'athlète concerné, comme le
// reste de ses données de performance.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const result = await dbGet<{
    athlete_id: string;
    attachment_path: string | null;
    attachment_mime_type: string | null;
  }>(`SELECT athlete_id, attachment_path, attachment_mime_type FROM effort_test_results WHERE id = ?`, [id]);
  if (!result || !result.attachment_path) return NextResponse.json({ error: "Pièce jointe introuvable." }, { status: 404 });

  const isSelf = user.role === "athlete" && user.id === result.athlete_id;
  const isLinkedCoach = user.role === "coach" && (await isCoachLinkedToAthlete(user.id, result.athlete_id));
  if (!isSelf && !isLinkedCoach) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const buffer = await readUploadedFile(result.attachment_path);
  if (!buffer) return NextResponse.json({ error: "Fichier introuvable sur le serveur." }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": result.attachment_mime_type || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
