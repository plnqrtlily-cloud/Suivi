import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getWorkoutsForAthlete, getCheckinForDate } from "@/lib/queries";
import { Nav } from "@/components/nav";
import { Card, StatusBadge, sportLabel } from "@/components/ui";
import { ReadinessSummary } from "../../readiness-summary";
import { DailyCheckin } from "../../daily-checkin";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AthleteDayPage({ params }: { params: Promise<{ date: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach");

  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const workouts = await getWorkoutsForAthlete(user.id, date, date);
  const checkin = await getCheckinForDate(user.id, date);
  const today = new Date().toISOString().slice(0, 10);
  const isToday = date === today;

  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
          <h2 className="mb-3 font-display text-xl text-ink">Séances</h2>
          {workouts.length === 0 ? (
            <Card>
              <p className="text-sm text-slate">Aucune séance prévue ce jour-là.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {workouts.map((w) => (
                <Link key={w.id} href={`/workouts/${w.id}`}>
                  <div
                    className="rounded-md border border-line bg-white p-4 text-sm hover:border-moss"
                    style={{ borderLeftColor: w.color, borderLeftWidth: 3 }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-ink">{w.title}</p>
                      <StatusBadge status={w.status} />
                    </div>
                    <p className="mt-1 text-slate">
                      {sportLabel(w.sport)} {w.time ? `· ${w.time}` : ""}
                      {w.duration_minutes ? ` · ${w.duration_minutes} min` : ""}
                    </p>
                  </div>
                </Link>
              ))}
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
