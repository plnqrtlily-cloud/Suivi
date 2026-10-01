import { NextResponse, type NextRequest } from "next/server";
import { dbGet } from "@/lib/db";
import { computePlanStatus } from "@/lib/billing";

// Fin de l'essai gratuit (3 mois, cf. src/lib/billing.ts) : l'espace coach est
// bloqué jusqu'au paiement. Le contrôle se fait ici plutôt que dans un layout,
// qui ne se ré-exécute pas à chaque navigation et n'empêche pas les pages en
// dessous de s'exécuter. /tarifs, /settings et la déconnexion restent
// accessibles (hors matcher) pour pouvoir payer ou gérer son compte.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;
  if (!token) return NextResponse.next();

  const row = await dbGet<{ role: string; plan: string; created_at: string; email: string; expires_at: string }>(
    `SELECT u.role, u.plan, u.created_at, u.email, s.expires_at
     FROM app_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    [token]
  );
  if (!row || row.role !== "coach" || new Date(row.expires_at).getTime() < Date.now()) return NextResponse.next();

  if (!computePlanStatus(row.plan, row.created_at, row.email).hasAccess) {
    return NextResponse.redirect(new URL("/tarifs?essai=termine", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/coach/:path*", "/workouts/:path*"],
};
