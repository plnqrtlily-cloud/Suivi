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
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

// Sert la photo ou vidéo jointe à un message — accessible uniquement aux deux
// participants de la conversation, comme le message lui-même.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const message = await dbGet<{ media_path: string | null; media_type: string | null; media_name: string | null; coach_id: string; athlete_id: string }>(
    `SELECT media_path, media_type, media_name, coach_id, athlete_id FROM messages WHERE id = ?`,
    [id]
  );
  if (!message || !message.media_path) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  if (message.coach_id !== user.id && message.athlete_id !== user.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const buffer = await readUploadedFile(message.media_path);
  if (!buffer) return NextResponse.json({ error: "Fichier introuvable sur le serveur." }, { status: 404 });

  const ext = message.media_path.slice(message.media_path.lastIndexOf(".")).toLowerCase();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": EXT_MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Un document est toujours téléchargé, jamais interprété par le navigateur.
      ...(message.media_type === "document"
        ? { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(message.media_name || `document${ext}`)}` }
        : {}),
    },
  });
}
