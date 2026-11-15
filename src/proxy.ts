import { NextResponse, type NextRequest } from "next/server";
import { dbGet } from "@/lib/db";
import { isAthleteSuspended, isCoachBlocked } from "@/lib/access";

// Fin de l'essai gratuit (3 mois, cf. src/lib/billing.ts) : l'espace coach est
// bloqué jusqu'au paiement. Le contrôle se fait ici plutôt que dans un layout,
// qui ne se ré-exécute pas à chaque navigation et n'empêche pas les pages en
// dessous de s'exécuter. /tarifs, /settings et la déconnexion restent
// accessibles (hors matcher) pour pouvoir payer ou gérer son compte. Les
// athlètes du coach sont suspendus avec lui (page /suspendu).
export async function proxy(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;
  if (!token) return NextResponse.next();

  const row = await dbGet<{ id: string; role: string; expires_at: string }>(
    `SELECT u.id, u.role, s.expires_at FROM app_sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
    [token]
  );
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return NextResponse.next();

  if (row.role === "coach") {
    if (request.nextUrl.pathname.startsWith("/athlete")) return NextResponse.next();
    if (await isCoachBlocked(row.id)) return NextResponse.redirect(new URL("/tarifs?essai=termine", request.url));
  } else if (row.role === "athlete" && (await isAthleteSuspended(row.id))) {
    return NextResponse.redirect(new URL("/suspendu", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/coach/:path*", "/workouts/:path*", "/athlete/:path*", "/sante/:path*"],
};
