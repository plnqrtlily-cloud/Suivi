import Link from "next/link";
import { Card, StatusBadge } from "@/components/ui";

// Décompte des objectifs à venir, inspiré de ce qui se fait de mieux sur les
// applications de coaching (TrainingPeaks affiche un compte à rebours vers la
// "Race Day" ; Nolio et RunMotion Coach mettent en avant le décompte vers
// l'objectif principal de la saison). La priorité A/B/C est la convention standard
// en préparation physique (popularisée par TrainingPeaks / Joe Friel) pour
// distinguer l'objectif principal (A, celui autour duquel se planifie l'affûtage)
// des objectifs secondaires (B) et sorties de calage (C) — plutôt que de traiter
// toutes les échéances à égalité, ce qu'un préparateur physique ne ferait jamais.

const PRIORITY_STYLES: Record<string, string> = {
  A: "bg-clay text-white",
  B: "bg-status-partial text-white",
  C: "bg-line text-ink-soft",
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function countdownLabel(days: number): string {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `J-${days}`;
}

// Urgence visuelle croissante à l'approche de l'échéance — utile pour qu'un
// préparateur physique repère en un coup d'œil les objectifs qui approchent sans
// avoir à comparer les dates lui-même.
function urgencyColor(days: number): string {
  if (days <= 7) return "text-clay";
  if (days <= 21) return "text-status-partial";
  return "text-moss-dark";
}

export function UpcomingGoals({ goals }: { goals: any[] }) {
  if (goals.length === 0) {
    return <p className="text-sm text-slate">Aucun objectif ou événement à venir programmé.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {goals.map((g) => {
        const days = daysUntil(g.date);
        return (
          <Link key={g.id} href={`/workouts/${g.id}`}>
            <Card className="flex items-center justify-between rounded-2xl hover:border-moss">
              <div className="flex items-center gap-3">
                <div className={`text-center ${urgencyColor(days)}`}>
                  <p className="font-display text-2xl leading-none">{countdownLabel(days)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink">{g.title}</p>
                    {g.priority && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[g.priority]}`}>
                        {g.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate">
                    {new Date(g.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
              <StatusBadge status={g.status} />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
