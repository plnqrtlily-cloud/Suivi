import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserGender, getAthleteSports, getUserAvatar } from "@/lib/queries";
import { setGenderAction, setAthleteSportsAction } from "@/lib/actions";
import { SelectField, Button } from "@/components/ui";
import { AvatarUpload } from "../avatar-upload";
import { SubPage, Panel } from "../moi-ui";

const SPORTS_LIST = [
  { value: "cycling", label: "Vélo / VTT" },
  { value: "running", label: "Course à pied" },
  { value: "hiking", label: "Randonnée" },
  { value: "swimming", label: "Natation" },
  { value: "climbing", label: "Escalade" },
  { value: "strength", label: "Musculation" },
  { value: "other", label: "Autre" },
];

export default async function InfosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "athlete") redirect("/coach/dashboard");
  const [gender, athleteSports, avatar] = await Promise.all([getUserGender(user.id), getAthleteSports(user.id), getUserAvatar(user.id)]);

  return (
    <SubPage user={user} title="Mes infos" subtitle="Visibles par tes coachs">
      <Panel title="Photo">
        <AvatarUpload userId={user.id} firstName={user.first_name} hasAvatar={!!avatar?.avatar_path} />
      </Panel>
      <Panel title="Genre et sports" hint="Le genre active le suivi du cycle pour un profil féminin.">
          <form
            action={async (formData) => {
              "use server";
              await setGenderAction(formData);
            }}
            className="flex items-end gap-3"
          >
            <div className="w-56">
              <SelectField label="Genre" name="gender" defaultValue={gender || ""}>
                <option value="" disabled>
                  Sélectionner…
                </option>
                <option value="female">Féminin</option>
                <option value="male">Masculin</option>
                <option value="other">Autre</option>
                <option value="prefer_not_to_say">Préfère ne pas dire</option>
              </SelectField>
            </div>
            <Button type="submit" variant="secondary">
              Enregistrer
            </Button>
          </form>

          <div className="mt-5 border-t border-line pt-5">
            <p className="mb-2 text-sm font-medium text-ink">Sport(s) pratiqué(s)</p>
            <p className="mb-3 text-xs text-slate">Visible par vos coachs, pour mieux cadrer votre suivi.</p>
            <form action={setAthleteSportsAction} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                {SPORTS_LIST.map((s) => (
                  <label key={s.value} className="flex items-center gap-1.5 text-sm text-ink-soft">
                    <input type="checkbox" name="sports" value={s.value} defaultChecked={athleteSports.includes(s.value)} />
                    {s.label}
                  </label>
                ))}
              </div>
              <div>
                <Button type="submit" variant="secondary">
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        
      </Panel>
    </SubPage>
  );
}
