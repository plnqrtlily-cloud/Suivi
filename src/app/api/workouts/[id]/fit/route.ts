import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutById } from "@/lib/queries";
import { buildFitWorkout } from "@/lib/fit-workout";

// Fichier .FIT "entraînement" à copier manuellement dans le dossier NEWFILES
// (ou WORKOUTS) de la montre Garmin connectée en USB — Garmin Connect n'offre
// pas d'import de fichier d'entraînement sur son site, contrairement à
// l'import d'activité (cf. suivi produit). Un seul palier couvrant la durée
// totale : ni cible d'allure/puissance/FC, ni intervalles, faute de structure
// détaillée pour les séances d'endurance dans le modèle de données actuel.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await params;
  const workout = await getWorkoutById(id);
  if (!workout) return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
  if (workout.athlete_id !== user.id && workout.coach_id !== user.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const bytes = buildFitWorkout({ title: workout.title, sport: workout.sport, durationMinutes: workout.duration_minutes });
  const safeName = workout.title.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "seance";

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.ant.fit",
      "Content-Disposition": `attachment; filename="${safeName}.fit"`,
    },
  });
}
