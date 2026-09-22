import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isCoachLinkedToAthlete, findUserById } from "@/lib/auth";
import {
  getWorkoutsForAthlete,
  getImportedActivitiesForRange,
  getAvailabilityBlocksForRange,
  getLatestMeasurements,
} from "@/lib/queries";
import { Nav } from "@/components/nav";
import { CoachSidebar } from "@/components/coach-sidebar";
import { Card, StatusBadge, sportLabel } from "@/components/ui";
import { RouteMap } from "@/components/route-map";
import { TIME_OF_DAY_ORDER, TIME_OF_DAY_LABELS, TIME_OF_DAY_HINTS, groupByTimeOfDay } from "@/lib/time-of-day";
import { AVAILABILITY_SLOT_LABELS } from "@/lib/time-of-day";
import { classifyHr } from "@/lib/hr-zones";
import { todayISO } from "@/lib/dates";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_LABELS: Record<string, string> = { manual: "saisie manuelle", garmin: "Garmin Connect", strava: "Strava" };

interface CalendarEntry {
  id: string;
  time: string | null;
  title: string;
  subtitle: string;
  color: string;
  href?: string;
  status?: string;
  routePoints?: string | null;
}

// Vue jour lecture seule côté coach — miroir de la vue jour de l'athlète, mais
// sans les contrôles d'édition/suppression (qui restent la main de
// l'athlète) : les séances renvoient vers leur page de détail/édition, le
// reste (activités importées, indisponibilités) s'affiche à titre indicatif.
export default async function CoachAthleteDayPage({ params }: { params: Promise<{ athleteId: string; date: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "coach") redirect("/athlete");

  const { athleteId, date } = await params;
  if (!DATE_RE.test(date)) notFound();
  if (!(await isCoachLinkedToAthlete(user.id, athleteId))) notFound();

  const athlete = await findUserById(athleteId);
  if (!athlete) notFound();

  const [workouts, imports, blocks, latest] = await Promise.all([
    getWorkoutsForAthlete(athleteId, date, date),
    getImportedActivitiesForRange(athleteId, date, date),
    getAvailabilityBlocksForRange(athleteId, date, date),
    getLatestMeasurements(athleteId),
  ]);
  const today = todayISO();
  const isToday = date === today;
  const hrZone = (avgHr: number | null) =>
    avgHr && latest.fc_repos && latest.fc_max ? classifyHr(avgHr, latest.fc_repos.value, latest.fc_max.value) : null;

  const entries: CalendarEntry[] = [
    ...workouts.map((w) => ({
      id: `w-${w.id}`,
      time: w.time,
      title: w.title,
      subtitle: `${sportLabel(w.sport)}${w.duration_minutes ? ` · ${w.duration_minutes} min` : ""} · séance prévue`,
      color: w.color,
      href: `/workouts/${w.id}`,
      status: w.status,
    })),
    ...imports.map((a) => {
      const zone = hrZone(a.avg_hr);
      return {
        id: `i-${a.id}`,
        time: a.activity_time,
        title: sportLabel(a.sport),
        subtitle: `${a.duration_minutes ? `${a.duration_minutes} min · ` : ""}${a.distance_km ? `${a.distance_km} km · ` : ""}${
          a.avg_hr ? `FC moy. ${a.avg_hr}${zone ? ` (Z${zone.zone})` : ""} · ` : ""
        }${SOURCE_LABELS[a.source] || a.source}`,
        color: "#7C5C46",
        routePoints: a.route_points,
      };
    }),
  ];

  const { byPhase, unscheduled } = groupByTimeOfDay(entries, (e) => e.time);
  const fullDayBlocks = blocks.filter((b) => b.time_of_day === "full_day");
  const blocksByPhase: Record<string, typeof blocks> = { morning: [], midday: [], afternoon: [], evening: [] };
  for (const b of blocks) {
    if (b.time_of_day !== "full_day") blocksByPhase[b.time_of_day].push(b);
  }

  function AvailabilityBrick({ b }: { b: (typeof blocks)[number] }) {
    return (
      <div className="flex items-center gap-3 rounded-md bg-ink p-4 text-sm text-white">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <rect x="4" y="9" width="12" height="8" rx="1.5" />
          <path d="M7 9V6a3 3 0 016 0v3" />
        </svg>
        <span className="truncate">
          <b className="font-semibold">{AVAILABILITY_SLOT_LABELS[b.time_of_day]} — indisponible</b>
          {b.reason && <span className="text-white/70"> — {b.reason}</span>}
        </span>
      </div>
    );
  }

  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function EntryCard({ e }: { e: CalendarEntry }) {
    const content = (
      <div
        className={`rounded-md border border-line bg-white p-4 text-sm ${e.href ? "hover:border-moss" : ""}`}
        style={{ borderLeftColor: e.color, borderLeftWidth: 3 }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-ink">{e.title}</p>
          {e.status && <StatusBadge status={e.status} />}
        </div>
        <p className="mt-1 text-slate">
          {e.time ? `${e.time} · ` : ""}
          {e.subtitle}
        </p>
        {e.routePoints && (
          <div className="mt-3">
            <RouteMap points={JSON.parse(e.routePoints)} />
          </div>
        )}
      </div>
    );
    return e.href ? (
      <Link key={e.id} href={e.href}>
        {content}
      </Link>
    ) : (
      <div key={e.id}>{content}</div>
    );
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <CoachSidebar user={user} />
      <div className="min-w-0 flex-1">
        <div className="lg:hidden">
          <Nav user={user} />
        </div>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <Link href={`/coach/athletes/${athleteId}`} className="mb-4 inline-block text-sm text-moss-dark hover:underline">
          ← Retour à {athlete.first_name}
        </Link>
        <h1 className="mb-1 font-display text-3xl capitalize text-ink">{formattedDate}</h1>
        {isToday && <p className="mb-6 text-sm text-moss-dark">Aujourd&apos;hui</p>}
        {!isToday && <div className="mb-6" />}

        <section>
          <h2 className="mb-3 font-display text-xl text-ink">Séances &amp; activités</h2>

          {entries.length === 0 && blocks.length === 0 ? (
            <Card>
              <p className="text-sm text-slate">Rien de prévu ni d&apos;enregistré ce jour-là.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              {fullDayBlocks.length > 0 && (
                <div className="flex flex-col gap-2">
                  {fullDayBlocks.map((b) => (
                    <AvailabilityBrick key={b.id} b={b} />
                  ))}
                </div>
              )}

              {TIME_OF_DAY_ORDER.map((phase) =>
                byPhase[phase].length > 0 || blocksByPhase[phase].length > 0 ? (
                  <div key={phase}>
                    <div className="mb-2 flex items-baseline gap-2">
                      <h3 className="font-display text-base text-ink">{TIME_OF_DAY_LABELS[phase]}</h3>
                      <span className="text-xs text-slate">{TIME_OF_DAY_HINTS[phase]}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {blocksByPhase[phase].map((b) => (
                        <AvailabilityBrick key={b.id} b={b} />
                      ))}
                      {byPhase[phase].map((e) => (
                        <EntryCard key={e.id} e={e} />
                      ))}
                    </div>
                  </div>
                ) : null
              )}

              {unscheduled.length > 0 && (
                <div>
                  <h3 className="mb-2 font-display text-base text-ink">Sans horaire</h3>
                  <div className="flex flex-col gap-2">
                    {unscheduled.map((e) => (
                      <EntryCard key={e.id} e={e} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      </div>
    </div>
  );
}
