import { ZONE_COLORS } from "@/components/zone-grid";

// Chaque type de bloc a sa couleur et son intensité visuelle : on lit le
// déroulé d'un coup d'œil (échauffement doux, effort marqué, récupération
// claire) au lieu de déchiffrer une liste de phrases.
const STEP_STYLES: Record<string, { label: string; color: string; bar: number }> = {
  warmup: { label: "Échauffement", color: "#6B7A8A", bar: 35 },
  work: { label: "Effort", color: "#E8896A", bar: 100 },
  recovery: { label: "Récupération", color: "#8FA8A3", bar: 25 },
  rest: { label: "Repos", color: "#B8C4C1", bar: 12 },
  cooldown: { label: "Retour au calme", color: "#1B4B4F", bar: 30 },
};

const TARGET_LABELS: Record<string, string> = {
  hr_zone: "FC",
  pace_zone: "Allure",
  power_zone: "Puissance",
};

// "10:00" -> "10 min", "01:30" -> "1 min 30", "00:45" -> "45 s".
// Le coach saisit en mm:ss ; l'athlète lit une durée en clair.
function formatTime(value: string): string {
  const match = value.trim().match(/^(\d+):(\d{1,2})$/);
  if (!match) return value;
  const min = Number(match[1]);
  const sec = Number(match[2]);
  if (min === 0) return `${sec} s`;
  if (sec === 0) return `${min} min`;
  return `${min} min ${String(sec).padStart(2, "0")}`;
}

function formatDuration(durationType: string, durationValue: string): string {
  if (durationType === "manual") return "au ressenti";
  if (durationType === "distance") {
    const n = Number(durationValue);
    // Au-delà du kilomètre, l'affichage en km se lit mieux que 5000 m.
    if (!Number.isNaN(n) && n >= 1000) return `${(n / 1000).toString().replace(".", ",")} km`;
    return `${durationValue} m`;
  }
  return formatTime(durationValue) || "—";
}

function TargetBadge({ target }: { target: any }) {
  if (!target || target.type === "none") return null;

  if (target.type === "free") {
    if (!target.freeText) return null;
    return (
      <span className="rounded-full bg-paper-dim px-2 py-0.5 text-[11px] font-medium text-ink-soft">
        {target.freeText}
      </span>
    );
  }

  const color = ZONE_COLORS[target.zone] || "#5B6660";
  return (
    <span
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {TARGET_LABELS[target.type]} Z{target.zone}
    </span>
  );
}

function StepRow({ step }: { step: any }) {
  const style = STEP_STYLES[step.stepType] ?? { label: step.stepType, color: "#5B6660", bar: 50 };
  return (
    <li className="flex items-stretch gap-3">
      {/* Barre d'intensité : sa hauteur donne le rythme de la séance sans lire. */}
      <span className="flex w-1.5 shrink-0 items-center">
        <span className="w-full rounded-full" style={{ backgroundColor: style.color, height: `${style.bar}%`, minHeight: 8 }} />
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
        <span className="text-sm font-medium" style={{ color: style.color }}>
          {style.label}
        </span>
        <span className="text-sm font-semibold text-ink">{formatDuration(step.durationType, step.durationValue)}</span>
        <TargetBadge target={step.target} />
      </span>
    </li>
  );
}

export function IntervalList({ json }: { json: string }) {
  let items: any[] = [];
  try {
    items = JSON.parse(json);
  } catch {
    return null;
  }
  if (!items.length) return null;

  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={item.id || i}>
          {item.kind === "repeat" ? (
            <div className="rounded-2xl border-2 border-dashed border-moss/40 bg-moss/5 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss-dark">
                <span className="text-sm">🔁</span>
                {item.count} × à répéter
              </p>
              <ol className="flex flex-col gap-1.5">
                {item.steps.map((s: any) => (
                  <StepRow key={s.id} step={s} />
                ))}
              </ol>
            </div>
          ) : (
            <ol>
              <StepRow step={item} />
            </ol>
          )}
        </li>
      ))}
    </ol>
  );
}
