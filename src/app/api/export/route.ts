import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbGet, dbAll } from "@/lib/db";

// Export RGPD en libre-service (cf. prompt, section "Format de l'export RGPD").
// NOTE : un vrai résumé PDF nécessiterait une lib de rendu PDF côté serveur ;
// ce prototype fournit le JSON complet (réutilisable) et un résumé texte lisible,
// suffisant pour démontrer le principe de portabilité — le PDF est un raffinement
// visuel, pas un changement de contenu.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const format = request.nextUrl.searchParams.get("format") === "summary" ? "summary" : "json";

  const profile = await dbGet<any>(`SELECT id, email, role, first_name, last_name, created_at FROM users WHERE id = ?`, [user.id]);
  const measurements = await dbAll(`SELECT metric, value, recorded_at FROM athlete_measurements WHERE athlete_id = ?`, [user.id]);
  const injuries = await dbAll(`SELECT zone, description, date_start, date_end FROM injuries WHERE athlete_id = ?`, [user.id]);
  const journal = await dbAll(`SELECT entry_date, content FROM journal_entries WHERE athlete_id = ?`, [user.id]);
  const cycleEntries = await dbAll(`SELECT entry_date, entry_type, notes FROM cycle_entries WHERE athlete_id = ?`, [user.id]);
  const workoutsAsAthlete = await dbAll(
    `SELECT sport, title, date, status, rpe, athlete_feedback FROM workouts WHERE athlete_id = ?`,
    [user.id]
  );
  const workoutsAsCoach = await dbAll(`SELECT sport, title, date, athlete_id FROM workouts WHERE coach_id = ?`, [user.id]);

  const data = {
    exported_at: new Date().toISOString(),
    profile,
    measurements,
    injuries,
    journal_entries: journal,
    cycle_entries: cycleEntries,
    workouts_received: workoutsAsAthlete,
    workouts_created_as_coach: workoutsAsCoach,
  };

  if (format === "summary") {
    const lines = [
      `Export de données — ${new Date().toLocaleDateString("fr-FR")}`,
      `Compte : ${(profile as any).first_name} ${(profile as any).last_name} (${(profile as any).email}) — rôle ${(profile as any).role}`,
      ``,
      `Mesures physiologiques : ${measurements.length} entrée(s)`,
      `Antécédents de blessures : ${injuries.length} entrée(s)`,
      `Journal de bord : ${journal.length} entrée(s)`,
      `Cycle menstruel : ${cycleEntries.length} entrée(s)`,
      `Séances reçues : ${workoutsAsAthlete.length}`,
      `Séances créées (si coach) : ${workoutsAsCoach.length}`,
      ``,
      `Le détail complet, machine-lisible, est disponible via l'export JSON depuis la même page.`,
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="mes-donnees-resume.txt"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mes-donnees.json"`,
    },
  });
}
