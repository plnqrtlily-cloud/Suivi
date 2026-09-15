import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getAthletesForCoach, getWorkoutsForAthlete } from "@/lib/queries";
import { getWeekDates, todayISO } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Avatar } from "@/components/avatar";
import { sportIconPath } from "@/lib/sport-icons";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Vue d'ensemble pensée pour un coach qui suit plusieurs athlètes : une seule
// grille (une ligne par athlète, une colonne par jour de la semaine) plutôt que
// de devoir ouvrir la fiche de chacun un par un pour voir qui a quoi de prévu.
export default async function CoachCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { week } = await searchParams;
  const offset = week ? Number(week) : 0;
  const weekDates = getWeekDates(offset);
  const today = todayISO();

  const links = await getAthletesForCoach(user.id);
  const activeAthletes = links.filter((l) => l.status === "active" && l.athlete_id);

  const workoutsByAthlete = await Promise.all(
    activeAthletes.map((l) => getWorkoutsForAthlete(l.athlete_id as string, weekDates[0], weekDates[6]))
  );

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/calendar" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-3xl text-ink">Calendrier de mes athlètes</h1>
          <div className="flex items-center gap-2">
            <Link href={`/coach/calendar?week=${offset - 1}`} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
              ‹
            </Link>
            <p className="text-sm font-semibold text-ink-soft">
              Semaine du {weekDates[0].slice(8, 10)} au {weekDates[6].slice(8, 10)}{" "}
              {new Date(`${weekDates[6]}T00:00:00`).toLocaleDateString("fr-FR", { month: "long" })}
            </p>
            <Link href={`/coach/calendar?week=${offset + 1}`} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
              ›
            </Link>
          </div>
        </div>

        {activeAthletes.length === 0 ? (
          <p className="text-sm text-slate">Aucun athlète actif pour l&apos;instant.</p>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-line bg-white">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="w-48 p-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate">Athlète</th>
                  {weekDates.map((date, i) => (
                    <th
                      key={date}
                      className={`p-3 text-center text-[11px] font-bold uppercase tracking-wider ${
                        date === today ? "text-gold-light" : "text-slate"
                      }`}
                    >
                      {DAY_LABELS[i]} {date.slice(8, 10)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeAthletes.map((link, idx) => {
                  const workouts = workoutsByAthlete[idx];
                  return (
                    <tr key={link.link_id} className="border-b border-line last:border-0">
                      <td className="p-3">
                        <Link href={`/coach/athletes/${link.athlete_id}`} className="flex items-center gap-2 hover:underline">
                          <Avatar userId={link.athlete_id!} firstName={link.first_name || "?"} hasAvatar={!!link.avatar_path} size="sm" />
                          <span className="font-medium text-ink">
                            {link.first_name} {link.last_name}
                          </span>
                        </Link>
                      </td>
                      {weekDates.map((date) => {
                        const dayWorkouts = workouts.filter((w) => w.date === date);
                        return (
                          <td key={date} className={`p-2 text-center ${date === today ? "bg-gold-light/5" : ""}`}>
                            {dayWorkouts.length > 0 ? (
                              <Link
                                href={`/coach/athletes/${link.athlete_id}/day/${date}`}
                                className="flex flex-col items-center gap-1 rounded-lg py-1 hover:bg-paper-dim"
                              >
                                <div className="flex items-center gap-1">
                                  {dayWorkouts.slice(0, 3).map((w) => (
                                    <svg key={w.id} width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={w.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                      <path d={sportIconPath(w.sport)} />
                                    </svg>
                                  ))}
                                </div>
                                {dayWorkouts.length > 3 && <span className="text-[9px] text-slate">+{dayWorkouts.length - 3}</span>}
                              </Link>
                            ) : (
                              <span className="text-line">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
