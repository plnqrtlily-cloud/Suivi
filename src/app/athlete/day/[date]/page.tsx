import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutsForAthlete, getCheckinForDate, getImportedActivitiesForRange } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { Card, StatusBadge, sportLabel } from "@/components/ui";
import { ReadinessSummary } from "../../readiness-summary";
import { DailyCheckin } from "../../daily-checkin";
import { TIME_OF_DAY_ORDER, TIME_OF_DAY_LABELS, TIME_OF_DAY_HINTS, groupByTimeOfDay } from "@/lib/time-of-day";
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
}

export default async function AthleteDayPage({ params }: { params: Promise<{ date: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach");

  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const [workouts, imports, checkin] = await Promise.all([
    getWorkoutsForAthlete(user.id, date, date),
    getImportedActivitiesForRange(user.id, date, date),
    getCheckinForDate(user.id, date),
  ]);
  const today = todayISO();
  const isToday = date === today;

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
    ...imports.map((a) => ({
      id: `i-${a.id}`,
      time: a.activity_time,
      title: sportLabel(a.sport),
      subtitle: `${a.duration_minutes ? `${a.duration_minutes} min · ` : ""}${a.distance_km ? `${a.distance_km} km · ` : ""}${
        a.avg_hr ? `FC moy. ${a.avg_hr} · ` : ""
      }${SOURCE_LABELS[a.source] || a.source}`,
      color: "#7C5C46",
    })),
  ];

  const { byPhase, unscheduled } = groupByTimeOfDay(entries, (e) => e.time);

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
        <div className="flex items-center justify-between">
          <p className="font-medium text-ink">{e.title}</p>
          {e.status && <StatusBadge status={e.status} />}
        </div>
        <p className="mt-1 text-slate">
          {e.time ? `${e.time} · ` : ""}
          {e.subtitle}
        </p>
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
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/athlete" className="mb-4 inline-block text-sm text-moss-dark hover:underline">
          ← Retour au calendrier
        </Link>
        <h1 className="mb-1 font-display text-3xl capitalize text-ink">{formattedDate}</h1>
        {isToday && <p className="mb-6 text-sm text-moss-dark">Aujourd&apos;hui</p>}
        {!isToday && <div className="mb-6" />}

        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl text-ink">Séances &amp; activités</h2>

          {entries.length === 0 ? (
            <Card>
              <p className="text-sm text-slate">Rien de prévu ni d&apos;enregistré ce jour-là.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              {TIME_OF_DAY_ORDER.map((phase) =>
                byPhase[phase].length > 0 ? (
                  <div key={phase}>
                    <div className="mb-2 flex items-baseline gap-2">
                      <h3 className="font-display text-base text-ink">{TIME_OF_DAY_LABELS[phase]}</h3>
                      <span className="text-xs text-slate">{TIME_OF_DAY_HINTS[phase]}</span>
                    </div>
                    <div className="flex flex-col gap-2">
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
      </main>
    </div>
  );
}
