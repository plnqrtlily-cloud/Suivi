import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getAthletesForCoach, getWorkoutsForAthlete } from "@/lib/queries";
import { getWeekDates, todayISO, getMonthGrid, monthLabel } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui";
import { sportIconPath } from "@/lib/sport-icons";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const PRIORITY_STYLES: Record<string, { label: string; className: string }> = {
  A: { label: "Principal", className: "bg-gold-light text-white" },
  B: { label: "Secondaire", className: "bg-clay text-white" },
  C: { label: "Préparatoire", className: "bg-slate text-white" },
};

function buildQuery(params: { vue?: string; semaine?: string; mois?: string; athlete?: string }) {
  const q = new URLSearchParams();
  if (params.vue) q.set("vue", params.vue);
  if (params.semaine) q.set("semaine", params.semaine);
  if (params.mois) q.set("mois", params.mois);
  if (params.athlete) q.set("athlete", params.athlete);
  const s = q.toString();
  return s ? `/coach/planification?${s}` : "/coach/planification";
}

// Vue de planification : le calendrier de tous les athlètes au même endroit,
// filtrable — pensé pour construire la programmation, là où /coach/calendar
// sert surtout à consulter la semaine en cours.
export default async function PlanificationPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; semaine?: string; mois?: string; athlete?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const sp = await searchParams;
  const vue = sp.vue === "mois" ? "mois" : "semaine";
  const weekOffset = sp.semaine ? Number(sp.semaine) : 0;
  const today = todayISO();

  const links = await getAthletesForCoach(user.id);
  const activeAthletes = links.filter((l) => l.status === "active" && l.athlete_id);
  const selectedAthleteId = sp.athlete && activeAthletes.some((a) => a.athlete_id === sp.athlete) ? sp.athlete : null;
  const shownAthletes = selectedAthleteId
    ? activeAthletes.filter((a) => a.athlete_id === selectedAthleteId)
    : activeAthletes;

  // Bornes de la période affichée
  const weekDates = getWeekDates(weekOffset);
  const now = new Date();
  const [yearStr, monthStr] = (sp.mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`).split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const monthGrid = getMonthGrid(year, monthNum - 1);
  const rangeFrom = vue === "semaine" ? weekDates[0] : monthGrid[0].date;
  const rangeTo = vue === "semaine" ? weekDates[6] : monthGrid[monthGrid.length - 1].date;

  const workoutsByAthlete = await Promise.all(
    shownAthletes.map((l) => getWorkoutsForAthlete(l.athlete_id as string, rangeFrom, rangeTo))
  );
  const allWorkouts = workoutsByAthlete.flat();
  const goals = allWorkouts
    .filter((w) => w.category === "objectif" || w.category === "evenement")
    .sort((a, b) => a.date.localeCompare(b.date));

  const prevMonth = monthNum === 1 ? `${year - 1}-12` : `${year}-${String(monthNum - 1).padStart(2, "0")}`;
  const nextMonth = monthNum === 12 ? `${year + 1}-01` : `${year}-${String(monthNum + 1).padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} activeHref="/coach/planification" />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="mb-1 font-display text-3xl text-ink">Planification</h1>
          <p className="mb-5 text-slate">Construisez la programmation de vos athlètes sur la période de votre choix.</p>

          {/* Filtres : période et athlète */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex rounded-2xl bg-paper-dim p-1">
              {[
                { value: "semaine", label: "Semaine" },
                { value: "mois", label: "Mois" },
              ].map((v) => (
                <Link
                  key={v.value}
                  href={buildQuery({ vue: v.value, athlete: selectedAthleteId || undefined })}
                  scroll={false}
                  className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    vue === v.value ? "bg-white text-ink shadow-sm" : "text-slate"
                  }`}
                >
                  {v.label}
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                href={buildQuery({ vue, semaine: vue === "semaine" ? "0" : undefined })}
                scroll={false}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  !selectedAthleteId ? "bg-moss text-white" : "border border-line text-slate"
                }`}
              >
                Tous
              </Link>
              {activeAthletes.map((a) => (
                <Link
                  key={a.link_id}
                  href={buildQuery({ vue, athlete: a.athlete_id as string })}
                  scroll={false}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedAthleteId === a.athlete_id ? "bg-moss text-white" : "border border-line text-slate"
                  }`}
                >
                  {a.first_name}
                </Link>
              ))}
            </div>
          </div>

          {/* Objectifs et événements de la période */}
          {goals.length > 0 && (
            <Card className="mb-5 rounded-3xl">
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">
                Objectifs et événements de la période
              </h2>
              <ul className="flex flex-col gap-2">
                {goals.map((g) => {
                  const athlete = activeAthletes.find((a) => a.athlete_id === g.athlete_id);
                  const prio = g.priority ? PRIORITY_STYLES[g.priority] : null;
                  return (
                    <li key={g.id}>
                      <Link href={`/workouts/${g.id}`} className="flex flex-wrap items-center gap-2 text-sm hover:underline">
                        {athlete && (
                          <Avatar userId={g.athlete_id} firstName={athlete.first_name || "?"} hasAvatar={!!athlete.avatar_path} size="sm" />
                        )}
                        <span className="text-ink">{g.title}</span>
                        {prio && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${prio.className}`}>{prio.label}</span>
                        )}
                        <span className="ml-auto text-xs text-slate">{g.date}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {activeAthletes.length === 0 ? (
            <Card className="rounded-3xl">
              <p className="text-slate">Aucun athlète actif pour l&apos;instant.</p>
            </Card>
          ) : vue === "semaine" ? (
            <>
              <div className="mb-3 flex items-center justify-center gap-3">
                <Link href={buildQuery({ vue, semaine: String(weekOffset - 1), athlete: selectedAthleteId || undefined })} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
                  ‹
                </Link>
                <p className="text-sm font-semibold text-ink-soft">
                  Semaine du {weekDates[0].slice(8, 10)}/{weekDates[0].slice(5, 7)} au {weekDates[6].slice(8, 10)}/
                  {weekDates[6].slice(5, 7)}
                </p>
                <Link href={buildQuery({ vue, semaine: String(weekOffset + 1), athlete: selectedAthleteId || undefined })} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
                  ›
                </Link>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-line bg-white">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="w-44 p-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate">Athlète</th>
                      {weekDates.map((date, i) => (
                        <th key={date} className={`p-2 text-center text-[11px] font-bold uppercase tracking-wider ${date === today ? "text-gold-light" : "text-slate"}`}>
                          {DAY_LABELS[i]} {date.slice(8, 10)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shownAthletes.map((link, idx) => {
                      const workouts = workoutsByAthlete[idx];
                      return (
                        <tr key={link.link_id} className="border-b border-line last:border-0">
                          <td className="p-3">
                            <Link href={`/coach/athletes/${link.athlete_id}`} className="flex items-center gap-2 hover:underline">
                              <Avatar userId={link.athlete_id!} firstName={link.first_name || "?"} hasAvatar={!!link.avatar_path} size="sm" />
                              <span className="truncate font-medium text-ink">{link.first_name}</span>
                            </Link>
                          </td>
                          {weekDates.map((date) => {
                            const dayWorkouts = workouts.filter((w) => w.date === date);
                            return (
                              <td key={date} className={`p-1.5 text-center align-top ${date === today ? "bg-gold-light/5" : ""}`}>
                                {dayWorkouts.length > 0 ? (
                                  <Link href={`/coach/athletes/${link.athlete_id}/day/${date}`} className="flex flex-col items-center gap-1 rounded-lg py-1 hover:bg-paper-dim">
                                    {dayWorkouts.slice(0, 2).map((w) => (
                                      <span key={w.id} className="flex items-center gap-1">
                                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke={w.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                          <path d={sportIconPath(w.sport)} />
                                        </svg>
                                      </span>
                                    ))}
                                    {dayWorkouts.length > 2 && <span className="text-[9px] text-slate">+{dayWorkouts.length - 2}</span>}
                                  </Link>
                                ) : (
                                  <Link
                                    href={`/coach/athletes/${link.athlete_id}/new-workout`}
                                    className="block rounded-lg py-1.5 text-line hover:bg-paper-dim hover:text-moss"
                                    title="Programmer une séance ce jour-là"
                                  >
                                    +
                                  </Link>
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
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-center gap-3">
                <Link href={buildQuery({ vue, mois: prevMonth, athlete: selectedAthleteId || undefined })} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
                  ‹
                </Link>
                <p className="text-sm font-semibold text-ink-soft">{monthLabel(year, monthNum - 1)}</p>
                <Link href={buildQuery({ vue, mois: nextMonth, athlete: selectedAthleteId || undefined })} scroll={false} className="flex h-8 w-8 items-center justify-center rounded-full text-slate hover:bg-paper-dim hover:text-ink">
                  ›
                </Link>
              </div>

              <Card className="rounded-3xl">
                <div className="mb-2 grid grid-cols-7 px-1">
                  {DAY_LABELS.map((d) => (
                    <span key={d} className="text-center text-[11px] font-medium text-slate">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthGrid.map((cell) => {
                    const dayWorkouts = allWorkouts.filter((w) => w.date === cell.date);
                    const isToday = cell.date === today;
                    return (
                      <div
                        key={cell.date}
                        className={`min-h-[62px] rounded-lg border p-1 ${
                          isToday ? "border-gold-light bg-gold-light/5" : "border-line"
                        } ${cell.inMonth ? "" : "opacity-40"}`}
                      >
                        <span className="text-[11px] font-semibold text-ink-soft">{cell.day}</span>
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          {dayWorkouts.slice(0, 3).map((w) => {
                            const athlete = activeAthletes.find((a) => a.athlete_id === w.athlete_id);
                            return (
                              <Link
                                key={w.id}
                                href={`/workouts/${w.id}`}
                                className="flex items-center gap-1 truncate rounded px-0.5 text-[10px] hover:bg-paper-dim"
                                title={`${athlete?.first_name ?? ""} — ${w.title}`}
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: w.color }} />
                                <span className="truncate text-ink-soft">{athlete?.first_name}</span>
                              </Link>
                            );
                          })}
                          {dayWorkouts.length > 3 && (
                            <span className="px-0.5 text-[9px] text-slate">+{dayWorkouts.length - 3}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
