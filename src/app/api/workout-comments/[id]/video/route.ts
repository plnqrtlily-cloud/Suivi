import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbGet } from "@/lib/db";
import { readUploadedFile } from "@/lib/storage";

const EXT_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

// Sert la vidéo jointe à un commentaire de séance — accessible uniquement au
// coach auteur de la séance et à l'athlète concerné, comme le reste des
// échanges autour d'une séance.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const comment = await dbGet<{ video_path: string | null; coach_id: string; athlete_id: string }>(
    `SELECT c.video_path, w.coach_id, w.athlete_id
     FROM workout_comments c JOIN workouts w ON w.id = c.workout_id
     WHERE c.id = ?`,
    [id]
  );
  if (!comment || !comment.video_path) return NextResponse.json({ error: "Vidéo introuvable." }, { status: 404 });
  if (comment.coach_id !== user.id && comment.athlete_id !== user.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const buffer = await readUploadedFile(comment.video_path);
  if (!buffer) return NextResponse.json({ error: "Fichier introuvable sur le serveur." }, { status: 404 });

  const ext = comment.video_path.slice(comment.video_path.lastIndexOf(".")).toLowerCase();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": EXT_MIME[ext] || "video/mp4",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
