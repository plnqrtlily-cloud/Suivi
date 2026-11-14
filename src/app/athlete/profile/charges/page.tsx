import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getExerciseMaxes, getPersonalRecordsForAthlete } from "@/lib/queries";
import { sportLabel } from "@/components/ui";
import { estimateOneRm } from "@/lib/one-rm";
import type { ExerciseMax } from "@/lib/queries";
import { SubPage, Panel } from "../moi-ui";

function formatPace(minPerKm: number): string {
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}

const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10).replace(".", ","));
function fmtSeconds(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m} min${r ? ` ${String(r).padStart(2, "0")}` : ""}` : `${r} s`;
}
// Arrondi à la charge réellement disponible en salle (pas de 2,5 kg).
const plate = (kg: number) => Math.round(kg / 2.5) * 2.5;

// Charges de référence (renseignées par le coach) : en lecture, avec ce qui
// sert en séance — le 1RM et les charges qui correspondent aux % demandés.
function MaxRow({ m }: { m: ExerciseMax }) {
  const date = new Date(`${m.tested_at.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  if (m.value_type !== "charge") {
    return (
      <li className="flex items-baseline justify-between gap-2 border-t border-paper-dim py-3 first:border-t-0 first:pt-0">
        <b className="text-[14.5px] text-ink">{m.exercise_name}</b>
        <span className="text-sm text-ink">
          {m.value_type === "temps" ? fmtSeconds(m.value_kg) : `${m.value_kg} répétitions`} <span className="text-xs text-slate">· {date}</span>
        </span>
      </li>
    );
  }
  const rm = estimateOneRm(m.value_kg, m.reps);
  return (
    <li className="flex flex-col gap-1.5 border-t border-paper-dim py-3 first:border-t-0 first:pt-0">
      <span className="flex items-baseline justify-between gap-2">
        <b className="text-[14.5px] text-ink">{m.exercise_name}</b>
        <span className="text-sm text-ink">
          <b>{num(rm)} kg</b> <span className="text-xs text-slate">{m.reps && m.reps > 1 ? `max estimé (${num(m.value_kg)} kg × ${m.reps})` : "max"} · {date}</span>
        </span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        {[60, 70, 80, 90].map((pct) => (
          <span key={pct} className="rounded-full bg-paper-dim px-2.5 py-0.5 text-xs text-ink-soft">
            {pct} % = <b className="text-ink">{num(plate((rm * pct) / 100))} kg</b>
          </span>
        ))}
      </span>
    </li>
  );
}

export default async function ChargesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");
  const [maxes, personalRecords] = await Promise.all([getExerciseMaxes(user.id), getPersonalRecordsForAthlete(user.id)]);
  // La valeur la plus récente par exercice.
  const latestMaxes = [...maxes]
    .sort((a, b) => b.tested_at.localeCompare(a.tested_at))
    .filter((m, i, all) => all.findIndex((x) => x.exercise_name.toLowerCase() === m.exercise_name.toLowerCase()) === i)
    .sort((a, b) => a.exercise_name.localeCompare(b.exercise_name, "fr"));

  return (
    <SubPage user={user} title="Charges et records" subtitle="Tes maximums, testés avec ton coach">
      <Panel title="Charges de référence" hint="Quand une séance indique un %, c'est un % de ce maximum : la charge correspondante est déjà calculée (arrondie à 2,5 kg).">
        {latestMaxes.length ? (
          <ul className="flex flex-col">
            {latestMaxes.map((m) => (
              <MaxRow key={m.id} m={m} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate">Pas encore de charge de référence : ton coach les ajoutera après vos tests.</p>
        )}
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
