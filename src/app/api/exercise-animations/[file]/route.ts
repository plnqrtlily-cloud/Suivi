import { NextResponse } from "next/server";
import { promises as fsp } from "fs";
import nodePath from "path";
import { getCurrentUser } from "@/lib/auth";
import { EXERCISE_ANIMATIONS } from "@/lib/exercise-animations";

// Animations d'exercices livrées avec l'application, servies telles quelles
// pour le détail d'un exercice (quand le coach n'a pas joint sa propre
// démonstration). Seuls les fichiers de la liste sont servis.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non autorisé", { status: 401 });
  const { file } = await params;
  if (!EXERCISE_ANIMATIONS.some((a) => a.file === file)) return new NextResponse("Introuvable", { status: 404 });
  try {
    const buffer = await fsp.readFile(nodePath.join(process.cwd(), "src", "assets", "exercise-animations", file));
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/gif", "Cache-Control": "private, max-age=604800, immutable" },
    });
  } catch {
    return new NextResponse("Introuvable", { status: 404 });
  }
}
