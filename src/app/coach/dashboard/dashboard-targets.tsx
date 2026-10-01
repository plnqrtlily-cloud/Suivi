// Briques communes aux tâches et aux notes du tableau de bord : cible
// (athlète, équipe ou club), étiquette colorée et libellés de date.

export interface TargetOption {
  value: string; // "club", "athlete:<id>" ou "team:<id>"
  label: string;
  group: "athlete" | "team" | "club";
}

export interface TargetFields {
  athlete_id: string | null;
  team_id: string | null;
  for_club: number | null;
  first_name?: string | null;
  team_name?: string | null;
}

export function targetValue(t: TargetFields): string {
  if (t.athlete_id) return `athlete:${t.athlete_id}`;
  if (t.team_id) return `team:${t.team_id}`;
  if (t.for_club) return "club";
  return "";
}

/** Champs de cible d'une ligne après un choix dans la liste (affichage immédiat). */
export function targetFieldsFrom(value: string, options: TargetOption[]): TargetFields {
  const opt = options.find((o) => o.value === value);
  const [kind, id] = value.split(":");
  if (kind === "athlete") return { athlete_id: id, team_id: null, for_club: 0, first_name: opt?.label.split(" ")[0] ?? null, team_name: null };
  if (kind === "team") return { athlete_id: null, team_id: id, for_club: 0, first_name: null, team_name: opt?.label ?? null };
  if (value === "club") return { athlete_id: null, team_id: null, for_club: 1, first_name: null, team_name: null };
  return { athlete_id: null, team_id: null, for_club: 0, first_name: null, team_name: null };
}

const TAG_STYLES = {
  athlete: "bg-paper-dim text-ink-soft",
  team: "bg-[#dbe7f0] text-[#24506f]",
  club: "bg-[#f6ecdc] text-[#7a4f15]",
};

/** Étiquette courte : prénom de l'athlète, nom de l'équipe ou « Club ». */
export function TargetTag({ t, className = "" }: { t: TargetFields; className?: string }) {
  const kind = t.athlete_id ? "athlete" : t.team_id ? "team" : t.for_club ? "club" : null;
  const label = kind === "athlete" ? t.first_name : kind === "team" ? t.team_name : kind === "club" ? "Club" : null;
  if (!kind || !label) return null;
  return (
    <span className={`shrink-0 truncate rounded-full px-2 py-px text-[11px] font-semibold ${TAG_STYLES[kind]} ${className}`}>
      {label}
    </span>
  );
}

export function TargetSelect({
  value,
  onChange,
  options,
  emptyLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: TargetOption[];
  emptyLabel: string;
}) {
  const groups: [TargetOption["group"], string][] = [
    ["team", "Équipes"],
    ["athlete", "Athlètes"],
  ];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line bg-white px-2 py-1.5 text-[13px] text-ink outline-none focus:border-moss"
    >
      <option value="">{emptyLabel}</option>
      <option value="club">Club</option>
      {groups.map(([g, label]) => {
        const opts = options.filter((o) => o.group === g);
        if (opts.length === 0) return null;
        return (
          <optgroup key={g} label={label}>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** « Auj. », « Demain », « Hier » ou « ven. 9 oct. » (année ajoutée si différente). */
export function shortDate(iso: string, today: string, long = false) {
  const diff = Math.round((parse(iso).getTime() - parse(today).getTime()) / 86400000);
  if (diff === 0) return long ? "Aujourd’hui" : "Auj.";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  const d = parse(iso);
  const base = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === parse(today).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function PlusButton({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Fermer" : label}
      aria-expanded={open}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-moss text-white transition-colors hover:bg-moss-dark"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`}
      >
        <path d="M10 4v12M4 10h12" />
      </svg>
    </button>
  );
}
