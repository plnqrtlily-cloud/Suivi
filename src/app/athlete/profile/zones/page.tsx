import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAthleteZones } from "@/lib/athlete-zones";
import { ZONE_NAMES, rangeLabels } from "@/lib/training-zones";
import { getCoachesForAthlete } from "@/lib/queries";
import { SubPage, Panel } from "../moi-ui";

const ZC = ["#c9dcdc", "#9fc3c4", "#5d8c8f", "#1b4b4f", "#a4492a"];

export default async function ZonesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");

  const [{ zones, source, adjusted, minutes }, coaches] = await Promise.all([getAthleteZones(user.id), getCoachesForAthlete(user.id)]);
  const coach = coaches[0]?.first_name ?? "ton coach";
  const cols = [
    zones.hr ? { key: "hr", label: "FC", unit: "", values: rangeLabels("hr", zones.hr) } : null,
    zones.pw ? { key: "pw", label: "Puissance", unit: " W", values: rangeLabels("pw", zones.pw) } : null,
    zones.pace ? { key: "pace", label: "Allure", unit: "", values: rangeLabels("pace", zones.pace) } : null,
  ].filter(Boolean) as { key: string; label: string; unit: string; values: string[] }[];
  const total = minutes.reduce((s, m) => s + m, 0);
  const subtitle = [adjusted ? `Ajustées par ${coach}` : source || null].filter(Boolean).join(" · ");

  return (
    <SubPage user={user} title="Mes zones" subtitle={subtitle || undefined}>
      {cols.length === 0 ? (
        <Panel>
          <p className="text-sm text-slate">
            Tes zones apparaissent dès qu&apos;une FC max, une FTP, une PMA ou une VMA est renseignée, par toi dans Tests et mesures ou par ton coach.
          </p>
        </Panel>
      ) : (
        <section className="overflow-x-auto rounded-2xl bg-white">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-[11.5px] uppercase tracking-wide text-slate">
                <th className="px-3.5 py-2.5 text-left font-bold" colSpan={2}>
                  <span className="sr-only">Zone</span>
                </th>
                {cols.map((c) => (
                  <th key={c.key} className="px-3 py-2.5 text-right font-bold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ZONE_NAMES.map((name, z) => (
                <tr key={name} className="border-t border-paper-dim">
                  <td className="w-12 py-2.5 pl-3.5">
                    <span className="inline-flex h-[22px] w-[30px] items-center justify-center rounded-md text-xs font-bold" style={{ background: ZC[z], color: z >= 2 ? "#fff" : "#182220" }}>
                      Z{z + 1}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2 text-slate">{name}</td>
                  {cols.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-ink">
                      {c.values[z]}
                      {c.unit}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <Panel title="Temps passé par zone" hint="4 dernières semaines, d'après la FC (ou la puissance) moyenne de tes séances faites">
        {total > 0 ? (
          <>
            <div className="flex h-3.5 overflow-hidden rounded-full">
              {minutes.map((m, z) => (m > 0 ? <span key={z} style={{ flex: m, background: ZC[z] }} /> : null))}
            </div>
            <div className="flex justify-between text-xs tabular-nums text-slate">
              {minutes.map((m, z) => (
                <span key={z}>
                  Z{z + 1} {Math.round((m / total) * 100)} %
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate">Pas encore assez de séances avec une FC ou une puissance moyenne.</p>
        )}
      </Panel>
    </SubPage>
  );
}
