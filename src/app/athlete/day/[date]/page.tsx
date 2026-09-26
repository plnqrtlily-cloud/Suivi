import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutsForAthlete, getCheckinForDate, getImportedActivitiesForRange, getAvailabilityBlocksForRange, getLatestMeasurements } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { Card, StatusBadge, sportLabel } from "@/components/ui";
import { ReadinessSummary } from "../../readiness-summary";
import { DailyCheckin } from "../../daily-checkin";
import { TIME_OF_DAY_ORDER, TIME_OF_DAY_LABELS, TIME_OF_DAY_HINTS, groupByTimeOfDay, formatPreciseTime } from "@/lib/time-of-day";
import { todayISO } from "@/lib/dates";
import { classifyHr } from "@/lib/hr-zones";
import { DeleteAvailabilityButton } from "@/components/delete-availability-button";
import { EditAvailabilityModal } from "@/components/availability-modal";
import { EditImportedActivityModal, DeleteImportedActivityButton } from "@/components/imported-activity-modal";
import { RouteMap } from "@/components/route-map";
import type { ImportedActivity } from "@/lib/queries";

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
  activity?: ImportedActivity;
}

export default async function AthleteDayPage({ params }: { params: Promise<{ date: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");

  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const [workouts, imports, checkin, blocks, latest] = await Promise.all([
    getWorkoutsForAthlete(user.id, date, date),
    getImportedActivitiesForRange(user.id, date, date),
    getCheckinForDate(user.id, date),
    getAvailabilityBlocksForRange(user.id, date, date),
    getLatestMeasurements(user.id),
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
        activity: a,
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
      <div className="flex items-center justify-between gap-3 rounded-md bg-ink p-4 text-sm text-white">
        <span className="flex min-w-0 items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <rect x="4" y="9" width="12" height="8" rx="1.5" />
            <path d="M7 9V6a3 3 0 016 0v3" />
          </svg>
          <span className="truncate">
            <b className="font-semibold">Indisponible</b>
            {b.reason && <span className="text-white/70"> — {b.reason}</span>}
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <EditAvailabilityModal block={b} className="text-white/50 hover:text-white" />
          <DeleteAvailabilityButton id={b.id} className="text-white/50 hover:text-white" />
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
          <span className="flex flex-shrink-0 items-center gap-2">
            {e.status && <StatusBadge status={e.status} />}
            {e.activity && (
              <span className="flex items-center gap-1.5 text-slate">
                <EditImportedActivityModal activity={e.activity} className="hover:text-ink" />
                <DeleteImportedActivityButton id={e.activity.id} className="hover:text-clay" />
              </span>
            )}
          </span>
        </div>
        <p className="mt-1 text-slate">
          {formatPreciseTime(e.time) ? `${formatPreciseTime(e.time)} · ` : ""}
          {e.subtitle}
        </p>
        {e.activity?.route_points && (
          <div className="mt-3">
            <RouteMap points={JSON.parse(e.activity.route_points)} />
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
    <div className="min-h-screen bg-paper">
      <Nav user={user} />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <Link href="/athlete" className="mb-4 inline-block text-sm text-moss-dark hover:underline">
          ← Retour au calendrier
        </Link>
        <h1 className="mb-1 font-display text-3xl capitalize text-ink">{formattedDate}</h1>
        {isToday && <p className="mb-6 text-sm text-moss-dark">Aujourd&apos;hui</p>}
        {!isToday && <div className="mb-6" />}

        <section className="mb-8">
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

        {/* La forme du jour n'a de sens que pour aujourd'hui (à renseigner) ou un
            jour passé déjà renseigné (à consulter) — on ne la propose jamais à
            l'avance pour un jour futur, et on n'invite pas à combler
            rétroactivement un jour passé resté vide. */}
        {(isToday || checkin) && (
          <section>
            <h2 className="mb-3 font-display text-xl text-ink">Forme du jour</h2>
            {checkin ? (
              <ReadinessSummary date={date} checkin={checkin} />
            ) : (
              <Card>
                <p className="mb-3 text-sm text-slate">Aucune forme enregistrée pour ce jour.</p>
                <DailyCheckin date={date} existing={checkin} />
              </Card>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
