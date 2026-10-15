// Frise compacte de la saison sous « Aujourd'hui » : les blocs du coach en
// barres fines proportionnelles à leur durée, un point « tu es ici » dans le
// bloc en cours, et le prochain objectif (losange + J-x) au bout.
export interface FriseSegment {
  id: string;
  name: string;
  weight: number;
  state: "past" | "current" | "future";
  progress: number;
}

const COLOR = { past: "#9fc3c4", current: "#1b4b4f", future: "#c9dcdc" };

export function SeasonFrise({ segments, goalLabel, goalTitle }: { segments: FriseSegment[]; goalLabel: string | null; goalTitle: string | null }) {
  if (!segments.length && !goalLabel) return null;
  if (!segments.length) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-slate">
        <span className="h-2 w-2 rotate-45 rounded-[2px] bg-[#c9a227]" />
        <b className="text-[#a4492a]">{goalLabel}</b>
        {goalTitle && <span className="truncate">{goalTitle}</span>}
      </p>
    );
  }
  return (
    <div className="flex items-start gap-1" aria-label="Où tu en es dans la saison">
      {segments.map((s) => (
        <div key={s.id} className="flex min-w-0 flex-col gap-1" style={{ flex: `${s.weight} 1 0`, minWidth: s.state === "current" ? 72 : undefined }}>
          <div className="relative h-1 rounded-full" style={{ background: COLOR[s.state] }}>
            {s.state === "current" && (
              <span
                className="absolute -top-1 h-3 w-3 -translate-x-1/2 rounded-full border-[3px] border-[#1b4b4f] bg-white"
                style={{ left: `${Math.round(s.progress * 100)}%` }}
                aria-label="tu es ici"
              />
            )}
          </div>
          <span className={`truncate text-[11px] ${s.state === "current" ? "font-bold text-ink" : "text-slate"}`} title={s.name}>
            {s.name}
          </span>
        </div>
      ))}
      {goalLabel && (
        <div className="-mt-[3px] flex flex-shrink-0 flex-col items-center gap-[3px]" title={goalTitle ?? undefined}>
          <span className="h-[9px] w-[9px] rotate-45 rounded-[2px] bg-[#c9a227]" />
          <span className="text-[11px] font-bold text-[#a4492a]">{goalLabel}</span>
        </div>
      )}
    </div>
  );
}
