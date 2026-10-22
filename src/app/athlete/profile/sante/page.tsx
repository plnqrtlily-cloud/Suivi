import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getInjuriesForAthlete, getUserGender, getCoachesForAthlete } from "@/lib/queries";
import { getOngoingHealthReports, getPainHistory, getUnreadHealthCounts, HEALTH_CATEGORY_LABEL, TRAINING_IMPACT_LABEL } from "@/lib/health";
import { getCycleSettings, getCycleEntries, estimateCyclePhase } from "@/lib/cycle";
import { todayISO } from "@/lib/dates";
import { InjuriesList } from "../injuries-list";
import { CyclePanel } from "../cycle-panel";
import { ReportHealthButton } from "@/components/report-health-button";
import { SubPage, Panel, Icon, ICONS } from "../moi-ui";

export default async function SantePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");

  const today = todayISO();
  const [injuries, gender, ongoing, coaches] = await Promise.all([
    getInjuriesForAthlete(user.id),
    getUserGender(user.id),
    getOngoingHealthReports(user.id, today),
    getCoachesForAthlete(user.id),
  ]);
  const [pains, unread] = await Promise.all([
    Promise.all(ongoing.map((r) => getPainHistory(r.id))),
    getUnreadHealthCounts(
      ongoing.map((r) => r.id),
      user.id
    ),
  ]);
  const female = gender === "female";
  const [cycleSettings, cycleEstimate, cycleEntries] = female
    ? await Promise.all([getCycleSettings(user.id), estimateCyclePhase(user.id), getCycleEntries(user.id)])
    : [null, null, []];
  const ongoingIds = new Set(ongoing.map((r) => r.id));
  const past = injuries.filter((i) => !ongoingIds.has(i.id));
  const coachName = coaches.length === 1 ? coaches[0].first_name : "ton coach";

  return (
    <SubPage user={user} title="Ma santé" subtitle="Ce que tu signales, ton coach le voit et peut en parler avec toi">
      <Panel title="En cours">
        {ongoing.length === 0 && <p className="text-sm text-slate">Rien en cours.</p>}
        {ongoing.map((r, i) => {
          const p = pains[i];
          const painLine = p.length > 1 ? `Douleur ${p[0].pain} → ${p[p.length - 1].pain}` : p.length ? `Douleur ${p[0].pain}` : null;
          return (
            <Link key={r.id} href={`/sante/${r.id}`} className="flex items-center gap-3 rounded-xl bg-[#fff4ef] px-3 py-2.5">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-white text-[#a4492a]">
                <Icon d={ICONS.health} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-[15px] font-semibold text-ink">{r.zone}</b>
                <span className="truncate text-[12.5px] text-slate">
                  {[HEALTH_CATEGORY_LABEL[r.category], painLine, r.training_impact ? TRAINING_IMPACT_LABEL[r.training_impact] : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              {(unread[r.id] || 0) > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e8896a] px-1.5 text-[11px] font-bold text-white">{unread[r.id]}</span>
              )}
              <span className="text-xs font-semibold text-moss-dark">Échanger</span>
            </Link>
          );
        })}
        <div>
          <ReportHealthButton today={today} coachName={coachName} />
        </div>
      </Panel>

      <Panel title="Historique" hint="Tes blessures passées, modifiables si une date ou une zone est fausse.">
        {past.length ? <InjuriesList injuries={past} /> : <p className="text-sm text-slate">Aucun antécédent.</p>}
      </Panel>

      <div id="cycle" className="scroll-mt-4">
        {female && cycleSettings && cycleEstimate ? (
          <Panel title="Mon cycle">
            <CyclePanel settings={cycleSettings} estimate={cycleEstimate} entries={cycleEntries} />
          </Panel>
        ) : !gender ? (
          <Panel>
            <p className="text-sm text-slate">
              Le suivi du cycle s&apos;affiche ici pour un profil féminin.{" "}
              <Link href="/athlete/profile/infos" className="font-semibold text-moss-dark">
                Renseigner mes infos
              </Link>
            </p>
          </Panel>
        ) : null}
      </div>
    </SubPage>
  );
}
