import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getUserGender, getAthleteSports, getUserAvatar, getCoachesForAthlete } from "@/lib/queries";
import { sportLabel } from "@/components/ui";
import { AvatarUpload } from "../avatar-upload";
import { SubPage, Panel } from "../moi-ui";

const GENDER_LABEL: Record<string, string> = {
  female: "Féminin",
  male: "Masculin",
  other: "Autre",
  prefer_not_to_say: "Non précisé",
};

// Genre et sports sont renseignés par le coach lors de l'entretien de départ ;
// l'athlète garde la main sur sa photo et voit à quoi servent ces infos.
export default async function InfosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");
  const [gender, athleteSports, avatar, coaches] = await Promise.all([
    getUserGender(user.id),
    getAthleteSports(user.id),
    getUserAvatar(user.id),
    getCoachesForAthlete(user.id),
  ]);
  const coach = coaches.length === 1 ? coaches[0] : null;
  const coachName = coach?.first_name ?? "ton coach";
  const askHref = coach ? `/athlete/messages/${coach.coach_id}` : "/athlete/messages";

  return (
    <SubPage user={user} title="Mes infos" subtitle={`Renseignées avec ${coachName} lors de votre entretien`}>
      <Panel title="Photo">
        <AvatarUpload userId={user.id} firstName={user.first_name} hasAvatar={!!avatar?.avatar_path} />
      </Panel>

      <Panel title="Sports pratiqués">
        {athleteSports.length ? (
          <div className="flex flex-wrap gap-2">
            {athleteSports.map((s) => (
              <span key={s} className="rounded-full bg-paper-dim px-3 py-1 text-sm font-semibold text-ink">
                {sportLabel(s)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate">Pas encore renseignés : {coachName} les ajoutera après votre entretien.</p>
        )}
        <p className="text-[13px] text-slate">Tes séances, tes zones d&apos;entraînement et tes tests sont pensés pour ces sports.</p>
      </Panel>

      <Panel title="Genre">
        <p className="text-sm font-semibold text-ink">{gender ? GENDER_LABEL[gender] ?? "Non précisé" : "Pas encore renseigné"}</p>
        {gender === "female" && (
          <p className="text-[13px] text-slate">
            Le suivi de ton cycle est disponible dans{" "}
            <Link href="/athlete/profile/sante#cycle" className="font-semibold text-moss-dark">
              Ma santé
            </Link>
            : il aide {coachName} à adapter les séances selon les phases.
          </p>
        )}
      </Panel>

      <p className="px-1 text-[13px] text-slate">
        Une info à corriger ?{" "}
        <Link href={askHref} className="font-semibold text-moss-dark">
          Écris à {coachName}
        </Link>
        .
      </p>
    </SubPage>
  );
}
