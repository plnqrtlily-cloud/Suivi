import { NextResponse, type NextRequest } from "next/server";
import { dbGet } from "@/lib/db";
import { coachRowBlocked, isAthleteSuspended } from "@/lib/access";

// Fin de l'essai gratuit (3 mois, cf. src/lib/billing.ts) : l'espace coach est
// bloqué jusqu'au paiement. Le contrôle se fait ici plutôt que dans un layout,
// qui ne se ré-exécute pas à chaque navigation et n'empêche pas les pages en
// dessous de s'exécuter. /tarifs, /settings et la déconnexion restent
// accessibles (hors matcher) pour pouvoir payer ou gérer son compte. Les
// athlètes du coach sont suspendus avec lui (page /suspendu).
//
// Rapidité : session et abonnement lus en une seule requête, et un accès
// autorisé est gardé une minute en mémoire — une navigation ne refait pas ce
// contrôle à chaque clic. Un refus n'est jamais gardé : après un paiement,
// l'accès revient tout de suite (une fin d'essai s'applique en 1 min au plus).
const DECISION_TTL_MS = 60_000;
const allowed = new Map<string, number>(); // jeton de session → valable jusqu'à

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;
  if (!token) return NextResponse.next();

  if ((allowed.get(token) ?? 0) > Date.now()) return NextResponse.next();

  {
    const row = await dbGet<{ id: string; role: string; expires_at: string; plan: string; created_at: string; email: string; athlete_trial_start: string | null }>(
      `SELECT u.id, u.role, s.expires_at, u.plan, u.created_at, u.email, u.athlete_trial_start
       FROM app_sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
      [token]
    );
    if (!row || new Date(row.expires_at).getTime() < Date.now()) return NextResponse.next();
    const verdict =
      row.role === "coach"
        ? coachRowBlocked(row)
          ? "blocked"
          : "ok"
        : row.role === "athlete" && (await isAthleteSuspended(row.id, row.athlete_trial_start))
          ? "suspended"
          : "ok";
    if (verdict === "blocked") {
      // Un coach garde l'accès à l'aperçu de l'espace athlète.
      if (request.nextUrl.pathname.startsWith("/athlete")) return NextResponse.next();
      return NextResponse.redirect(new URL("/tarifs?essai=termine", request.url));
    }
    if (verdict === "suspended") return NextResponse.redirect(new URL("/suspendu", request.url));
    if (allowed.size > 5000) allowed.clear();
    allowed.set(token, Date.now() + DECISION_TTL_MS);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/coach/:path*", "/workouts/:path*", "/athlete/:path*", "/sante/:path*"],
};
