const STEP_LABELS: Record<string, string> = {
  warmup: "Échauffement",
  work: "Effort",
  recovery: "Récupération",
  rest: "Repos",
  cooldown: "Retour au calme",
};

function formatDuration(durationType: string, durationValue: string): string {
  if (durationType === "manual") return "manuel";
  if (durationType === "distance") return `${durationValue} m`;
  return durationValue || "—";
}

function formatTarget(target: any): string {
  if (!target || target.type === "none") return "";
  if (target.type === "free") return target.freeText ? ` — ${target.freeText}` : "";
  const labels: Record<string, string> = { hr_zone: "Zone FC", pace_zone: "Zone allure", power_zone: "Zone puissance" };
  return ` — ${labels[target.type]} ${target.zone}`;
}

function StepLine({ step }: { step: any }) {
  return (
    <li className="text-sm text-ink">
      <span className="font-medium">{STEP_LABELS[step.stepType] || step.stepType}</span>
      {" — "}
      {formatDuration(step.durationType, step.durationValue)}
      {formatTarget(step.target)}
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
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={item.id || i}>
          {item.kind === "repeat" ? (
            <div className="rounded-xl border border-dashed border-moss/40 p-2">
              <p className="mb-1 text-sm font-medium text-moss-dark">Répéter {item.count} fois :</p>
              <ol className="flex flex-col gap-1 pl-3">
                {item.steps.map((s: any) => (
                  <StepLine key={s.id} step={s} />
                ))}
              </ol>
            </div>
          ) : (
            <StepLine step={item} />
          )}
        </li>
      ))}
    </ol>
  );
}
