import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbAll } from "@/lib/db";
import { buildWorkoutsICS } from "@/lib/ics";
import { toISODate } from "@/lib/dates";
import type { Workout } from "@/lib/queries";

// Flux iCalendar auquel Google Agenda / Apple Calendrier s'abonnent. Ces
// clients interrogent l'URL depuis LEURS serveurs, sans cookie de session :
// l'authentification passe donc par un jeton secret dans l'URL, révocable en
// le régénérant depuis les paramètres. Le flux est en lecture seule et ne
// contient que les séances de l'athlète concerné.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Jeton invalide." }, { status: 404 });
  }

  const user = await dbGet<{ id: string; first_name: string; last_name: string }>(
    `SELECT id, first_name, last_name FROM users WHERE calendar_token = ?`,
    [token]
  );
  if (!user) return NextResponse.json({ error: "Calendrier introuvable." }, { status: 404 });

  // Fenêtre volontairement bornée : un agenda n'a pas besoin de tout
  // l'historique, et cela garde le flux léger à chaque rafraîchissement.
  const from = new Date();
  from.setMonth(from.getMonth() - 3);
  const to = new Date();
  to.setMonth(to.getMonth() + 12);

  const workouts = await dbAll<Workout>(
    `SELECT * FROM workouts WHERE athlete_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC`,
    [user.id, toISODate(from), toISODate(to)]
  );

  const ics = buildWorkoutsICS(workouts, `${user.first_name} ${user.last_name}`);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="rythme.ics"',
      "Cache-Control": "private, max-age=1800",
    },
  });
}
