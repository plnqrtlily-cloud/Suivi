import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getExerciseMaxes, getPersonalRecordsForAthlete } from "@/lib/queries";
import { sportLabel } from "@/components/ui";
import { ExerciseMaxesPanel } from "@/app/coach/athletes/[athleteId]/exercise-maxes-panel";
import { SubPage, Panel } from "../moi-ui";

function formatPace(minPerKm: number): string {
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}

export default async function ChargesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");
  const [maxes, personalRecords] = await Promise.all([getExerciseMaxes(user.id), getPersonalRecordsForAthlete(user.id)]);

  return (
    <SubPage user={user} title="Charges et records" subtitle="Tes maximums par exercice servent à ton coach pour doser la musculation">
      <Panel title="Charges de référence" hint="Charge, durée ou répétitions maximales testées par exercice.">
        <ExerciseMaxesPanel athleteId={user.id} maxes={maxes} exerciseSuggestions={[]} />
      </Panel>
        {personalRecords.length > 0 && (
          <Panel title="Records personnels" hint="Calculés à partir de tes séances faites : plus longue distance, meilleure allure et plus longue durée, sport par sport.">
            <div className="grid gap-3 sm:grid-cols-2">
              {personalRecords.map((r) => (
                <div key={r.sport} className="rounded-2xl border border-line p-3.5">
                  <p className="mb-2 text-sm font-semibold text-ink">{sportLabel(r.sport)}</p>
                  <ul className="space-y-1 text-sm">
                    {r.bestDistanceKm !== null && (
                      <li className="flex items-baseline justify-between gap-2">
                        <span className="text-slate">Plus longue distance</span>
                        <span className="font-medium text-ink">
                          {r.bestDistanceKm} km <span className="text-xs text-slate">({r.bestDistanceDate})</span>
                        </span>
                      </li>
                    )}
                    {r.bestPaceMinPerKm !== null && (
                      <li className="flex items-baseline justify-between gap-2">
                        <span className="text-slate">Meilleure allure</span>
                        <span className="font-medium text-ink">
                          {formatPace(r.bestPaceMinPerKm)} <span className="text-xs text-slate">({r.bestPaceDate})</span>
                        </span>
                      </li>
                    )}
                    {r.bestDurationMinutes !== null && (
                      <li className="flex items-baseline justify-between gap-2">
                        <span className="text-slate">Plus longue durée</span>
                        <span className="font-medium text-ink">
                          {r.bestDurationMinutes} min <span className="text-xs text-slate">({r.bestDurationDate})</span>
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        )}

    </SubPage>
  );
}
