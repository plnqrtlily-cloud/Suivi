import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getLatestMeasurements,
  getUserGender,
  getAthleteSports,
  getUserAvatar,
  getExerciseMaxes,
  getPerformanceProfile,
  getCoachesForAthlete,
  getEffortTestBatchesForAthlete,
  getPersonalRecordsForAthlete,
  getCalendarToken,
} from "@/lib/queries";
import { getOngoingHealthReports } from "@/lib/health";
import { getCycleSettings, estimateCyclePhase } from "@/lib/cycle";
import { PHASE_LABELS } from "@/lib/cycle-types";
import { EFFORT_TEST_CATALOG } from "@/lib/effort-tests";
import { todayISO } from "@/lib/dates";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";
import { sportLabel } from "@/components/ui";
import { MoiGroup, MoiRow, ICONS } from "./moi-ui";

function frShort(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function num(v: number | undefined, unit = "") {
  if (v == null) return "—";
  return `${String(Math.round(v * 10) / 10).replace(".", ",")}${unit}`;
}

// « Moi » : tout ce qui concerne l'athlète, regroupé en une page courte ;
// chaque ligne ouvre sa propre page.
export default async function MoiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");

  const today = todayISO();
  const [latest, gender, sports, avatar, maxes, perf, coaches, batches, records, health, calToken] = await Promise.all([
    getLatestMeasurements(user.id),
    getUserGender(user.id),
    getAthleteSports(user.id),
    getUserAvatar(user.id),
    getExerciseMaxes(user.id),
    getPerformanceProfile(user.id),
    getCoachesForAthlete(user.id),
    getEffortTestBatchesForAthlete(user.id),
    getPersonalRecordsForAthlete(user.id),
    getOngoingHealthReports(user.id, today),
    getCalendarToken(user.id),
  ]);
  const female = gender === "female";
  const [cycleSettings, cycle] = female ? await Promise.all([getCycleSettings(user.id), estimateCyclePhase(user.id)]) : [null, null];

  const coachNames = coaches.map((c) => c.first_name).join(", ");
  const rated = perf.qualities.filter((q) => q.athlete_level).length;
  const toRate = !!perf.selfRequestedAt && (!perf.selfEvalDate || perf.selfEvalDate < perf.selfRequestedAt);
  const lastTest = batches[0];
  const lastTestLabel = lastTest
    ? `Dernier test : ${lastTest.customLabel ?? (lastTest.testSlug ? EFFORT_TEST_CATALOG[lastTest.testSlug]?.label : null) ?? "test"} · ${frShort(lastTest.testDate)}`
    : Object.keys(latest).length
      ? "Mesures et suivi de ton évolution"
      : "Ajoute ta première mesure";
  const zonesSub = latest.fc_max || latest.ftp || latest.pma_vma ? "FC, puissance, allure" : "Renseigne FC max, FTP ou VMA";
  const sportsLine = [sports.map((s) => sportLabel(s)).join(" · "), coachNames ? `suivi par ${coachNames}` : null].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-[#f2f4f3]">
      <Nav user={user} />
      <main className="mx-auto flex max-w-xl flex-col pb-28 lg:pb-10">
        <header className="flex flex-col items-center gap-2 px-5 pb-3.5 pt-6 text-center">
          <Link href="/athlete/profile/infos" aria-label="Modifier ma photo et mes infos" className="rounded-full border-[3px] border-white shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
            <Avatar userId={user.id} firstName={user.first_name} hasAvatar={!!avatar?.avatar_path} size="lg" />
          </Link>
          <b className="text-[22px] text-ink">
            {user.first_name} {user.last_name}
          </b>
          {sportsLine && <span className="text-[13.5px] text-slate">{sportsLine}</span>}
        </header>

        <div className="mx-4 mb-3.5 flex rounded-2xl bg-white px-1.5 py-3">
          {[
            [num(latest.ftp?.value, " W"), "FTP"],
            [num(latest.fc_max?.value), "FC max"],
            [num(latest.fc_repos?.value), "FC repos"],
            [num(latest.weight_kg?.value, " kg"), "Poids"],
          ].map(([v, l]) => (
            <Link key={l} href="/athlete/profile/mesures" className="flex flex-1 flex-col items-center">
              <b className="text-lg tabular-nums text-ink">{v}</b>
              <span className="text-[11.5px] text-slate">{l}</span>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-3.5 px-4">
          <MoiGroup label="Ma performance">
            <MoiRow href="/athlete/profile/zones" icon={ICONS.zones} color="#1b4b4f" title="Mes zones" sub={zonesSub} />
            <MoiRow href="/athlete/profile/mesures" icon={ICONS.tests} color="#1b4b4f" title="Tests et mesures" sub={lastTestLabel} />
            {perf.qualities.length > 0 && (
              <MoiRow
                href="/athlete/auto-evaluation"
                icon={ICONS.star}
                color="#7a5aa6"
                title="Mon auto-évaluation"
                sub={`${rated} qualité${rated > 1 ? "s" : ""} notée${rated > 1 ? "s" : ""} sur ${perf.qualities.length}`}
                badge={toRate ? "À mettre à jour" : perf.qualities.length > rated ? `${perf.qualities.length - rated} à noter` : undefined}
              />
            )}
            <MoiRow
              href="/athlete/profile/charges"
              icon={ICONS.grid}
              color="#1b4b4f"
              title="Charges et records"
              sub={[maxes.length ? `${maxes.length} charge${maxes.length > 1 ? "s" : ""} de référence` : null, records.length ? `records sur ${records.length} sport${records.length > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ") || "Tes maximums et tes records"}
            />
          </MoiGroup>

          <MoiGroup label="Ma santé">
            <MoiRow
              href="/athlete/profile/sante"
              icon={ICONS.health}
              color="#a4492a"
              title="Blessures et maladies"
              sub={health.length ? health.map((h) => h.zone).join(" · ") : "Rien en cours"}
              badge={health.length ? "En cours" : undefined}
            />
            {female && (
              <MoiRow
                href="/athlete/profile/sante#cycle"
                icon={ICONS.drop}
                color="#e8896a"
                title="Mon cycle"
                sub={[
                  cycle && cycle.phase !== "inconnue" ? `${PHASE_LABELS[cycle.phase]}${cycle.dayOfCycle ? ` · J${cycle.dayOfCycle}` : ""}` : "Renseigne tes règles",
                  cycleSettings?.share_with_coaches ? `partagé avec ${coachNames || "ton coach"}` : "non partagé",
                ].join(" · ")}
              />
            )}
          </MoiGroup>

          <MoiGroup label="Mon compte">
            <MoiRow href="/athlete/profile/infos" icon={ICONS.user} color="#1b4b4f" title="Mes infos" sub="Photo, genre, sports pratiqués" />
            <MoiRow href="/settings#coachs" icon={ICONS.coach} color="#1b4b4f" title="Mes coachs" sub={coachNames || "Rejoindre un coach avec son code"} />
            <MoiRow href="/settings#calendrier" icon={ICONS.link} color="#1b4b4f" title="Mon calendrier" sub={calToken ? "Synchronisé avec ton agenda" : "Synchroniser avec Google, Apple, Outlook"} />
            <MoiRow href="/settings" icon={ICONS.gear} color="#5b6660" title="Paramètres" sub="Notifications, données, sécurité" />
          </MoiGroup>
        </div>
      </main>
    </div>
  );
}
