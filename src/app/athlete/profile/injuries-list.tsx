import type { Injury } from "@/lib/queries";

// Antécédents de blessure, renseignés par le coach lors de l'entretien : en
// lecture seule pour l'athlète, avec ce qui lui sert au quotidien (ce qu'il
// faut surveiller, les conseils de son coach).
function frDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}
function weeksBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(`${b.slice(0, 10)}T00:00:00`).getTime() - new Date(`${a.slice(0, 10)}T00:00:00`).getTime()) / (7 * 86400000)));
}

export function InjuriesList({ injuries }: { injuries: Injury[] }) {
  if (injuries.length === 0) return <p className="text-sm text-slate">Aucun antécédent.</p>;
  return (
    <ul className="flex flex-col">
      {injuries.map((i) => (
        <li key={i.id} className="flex flex-col gap-1 border-t border-paper-dim py-3 first:border-t-0 first:pt-0">
          <span className="flex items-baseline justify-between gap-2">
            <b className="text-[14.5px] text-ink">
              {i.zone}
              {i.side ? ` (${i.side})` : ""}
            </b>
            <span className="flex-shrink-0 text-xs text-slate">
              {frDate(i.date_start)}
              {i.date_end ? ` · ${weeksBetween(i.date_start, i.date_end)} sem.` : ""}
            </span>
          </span>
          {i.description && <span className="text-[13px] text-ink-soft">{i.description}</span>}
          {i.advice && (
            <span className="mt-1 rounded-xl bg-[#eef4f3] px-3 py-2 text-[13px] text-ink">
              <b className="font-semibold text-moss-dark">À surveiller : </b>
              {i.advice}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
