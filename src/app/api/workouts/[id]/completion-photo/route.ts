import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbGet } from "@/lib/db";
import { readUploadedFile } from "@/lib/storage";

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Sert la photo prise au moment de valider la séance — visible par l'athlète
// concerné et son coach uniquement.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const workout = await dbGet<{ completion_photo_path: string | null; coach_id: string; athlete_id: string }>(
    `SELECT completion_photo_path, coach_id, athlete_id FROM workouts WHERE id = ?`,
    [id]
  );
  if (!workout || !workout.completion_photo_path) {
    return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
  }
  if (workout.coach_id !== user.id && workout.athlete_id !== user.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const buffer = await readUploadedFile(workout.completion_photo_path);
  if (!buffer) return NextResponse.json({ error: "Fichier introuvable sur le serveur." }, { status: 404 });

  const ext = workout.completion_photo_path.slice(workout.completion_photo_path.lastIndexOf(".")).toLowerCase();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": EXT_MIME[ext] || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
