import { NextResponse } from "next/server";
import { EXERCISE_ANIMATIONS, animationUrl } from "@/lib/exercise-animations";

// Ancienne adresse des animations livrées : elles sont désormais des fichiers
// publics (public/exercise-animations/), servis directement par le CDN.
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!EXERCISE_ANIMATIONS.some((a) => a.file === file)) return new NextResponse("Introuvable", { status: 404 });
  return NextResponse.redirect(new URL(animationUrl(file), req.url), 308);
}
