import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { dbAll } from "@/lib/db";
import { getCoachesForAthlete } from "@/lib/queries";
import { HEALTH_CATEGORY_LABEL, type HealthCategory } from "@/lib/health";
import { todayISO } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";

// Heure du dernier message comme dans Messages : l'heure aujourd'hui, « hier »,
// le jour de la semaine sur 7 jours, sinon la date.
function when(ts: string | null, today: string) {
  if (!ts) return "";
  const d = new Date(`${ts.replace(" ", "T")}Z`);
  const day = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  if (day === today) return d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  const diff = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${day}T00:00:00`).getTime()) / 86400000);
  if (diff === 1) return "hier";
  if (diff < 7) return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "short" });
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" });
}

interface Row {
  key: string;
  href: string;
  name: string;
  sub?: string;
  last: string;
  at: string | null;
  unread: number;
  avatar: React.ReactNode;
}

export default async function AthleteMessagesIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");

  const today = todayISO();
  const [coaches, lastByCoach, threads] = await Promise.all([
    getCoachesForAthlete(user.id),
    dbAll<{ coach_id: string; body: string; media_type: string | null; sender_id: string; created_at: string; unread: number }>(
      `SELECT m.coach_id, m.body, m.media_type, m.sender_id, m.created_at,
              (SELECT COUNT(*) FROM messages u WHERE u.coach_id = m.coach_id AND u.athlete_id = m.athlete_id AND u.sender_id != ? AND u.read_at IS NULL) as unread
       FROM messages m
       WHERE m.athlete_id = ? AND m.created_at = (SELECT MAX(created_at) FROM messages x WHERE x.coach_id = m.coach_id AND x.athlete_id = m.athlete_id)`,
      [user.id, user.id]
    ),
    // Fils santé : en cours, ou terminés depuis moins de 30 jours.
    dbAll<{ id: string; zone: string; category: string | null; date_end: string | null; body: string | null; author_id: string | null; author: string | null; created_at: string | null; unread: number }>(
      `SELECT i.id, i.zone, i.category, i.date_end, h.body, h.author_id, u.first_name as author, h.created_at,
              (SELECT COUNT(*) FROM health_messages r WHERE r.injury_id = i.id AND r.kind = 'message' AND r.author_id != ? AND r.read_at IS NULL) as unread
       FROM injuries i
       JOIN health_messages h ON h.id = (SELECT id FROM health_messages z WHERE z.injury_id = i.id ORDER BY z.created_at DESC, z.rowid DESC LIMIT 1)
       LEFT JOIN users u ON u.id = h.author_id
       WHERE i.athlete_id = ? AND (i.date_end IS NULL OR i.date_end >= date(?, '-30 days'))`,
      [user.id, user.id, today]
    ),
  ]);

  const rows: Row[] = [
    ...coaches.map((c) => {
      const l = lastByCoach.find((x) => x.coach_id === c.coach_id);
      const preview = l ? (l.body?.trim() ? l.body : l.media_type?.startsWith("image") ? "Photo" : l.media_type?.startsWith("video") ? "Vidéo" : "Pièce jointe") : "Écris à ton coach";
      return {
        key: c.link_id,
        href: `/athlete/messages/${c.coach_id}`,
        name: `${c.first_name} ${c.last_name}`.trim(),
        last: l && l.sender_id === user.id ? `Toi : ${preview}` : preview,
        at: l?.created_at ?? null,
        unread: Number(l?.unread ?? 0),
        avatar: <Avatar userId={c.coach_id} firstName={c.first_name} hasAvatar={false} size="md" />,
      };
    }),
    ...threads.map((t) => ({
      key: t.id,
      href: `/sante/${t.id}`,
      name: t.zone,
      sub: `${HEALTH_CATEGORY_LABEL[(t.category as HealthCategory) || "blessure"]} · ${t.date_end && t.date_end < today ? "terminé" : "en cours"}`,
      last: t.body ? (t.author_id === user.id ? `Toi : ${t.body}` : `${t.author ?? "Coach"} : ${t.body}`) : "",
      at: t.created_at,
      unread: Number(t.unread),
      avatar: (
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#fbe3da] text-[#a4492a]">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 16.5s-6-3.6-6-8.2A3.3 3.3 0 0110 6.3a3.3 3.3 0 016 2c0 4.6-6 8.2-6 8.2z" />
          </svg>
        </span>
      ),
    })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return (
    <div className="min-h-screen bg-[#f2f4f3]">
      <Nav user={user} />
      <main className="mx-auto flex max-w-xl flex-col pb-28 lg:pb-10">
        <header className="px-5 pb-3 pt-6">
          <h1 className="text-[30px] font-bold leading-tight tracking-tight text-ink">Messages</h1>
        </header>
        {rows.length === 0 ? (
          <p className="mx-4 rounded-2xl bg-white px-4 py-4 text-sm text-slate">
            Aucun coach lié pour l&apos;instant. Rejoins ton coach avec son code d&apos;invitation dans{" "}
            <Link href="/settings#coachs" className="font-semibold text-moss-dark">
              Moi › Mes coachs
            </Link>
            .
          </p>
        ) : (
          <ul className="overflow-hidden rounded-t-[18px] bg-white lg:rounded-[18px]">
            {rows.map((r) => (
              <li key={r.key} className="border-b border-paper-dim last:border-0">
                <Link href={r.href} className="flex items-center gap-3 px-4 py-3 hover:bg-[#f7f8f8]">
                  {r.avatar}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline gap-2">
                      <b className="flex-1 truncate text-[15.5px] text-ink">{r.name}</b>
                      <span className="flex-shrink-0 text-[12.5px] text-slate">{when(r.at, today)}</span>
                    </span>
                    {r.sub && <span className="text-xs font-semibold text-[#a4492a]">{r.sub}</span>}
                    <span className="flex items-center gap-2">
                      <span className={`flex-1 truncate text-sm ${r.unread ? "font-semibold text-ink" : "text-slate"}`}>{r.last}</span>
                      {r.unread > 0 && (
                        <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#0a84ff] px-1.5 text-[11px] font-bold text-white">
                          {r.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
