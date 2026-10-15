"use client";

// Échelle de douleur 0-10 en cases colorées, du vert d'eau (aucune) au brique
// (insupportable) : un toucher suffit, pas de curseur à faire glisser.
const COLORS = ["#c9dcdc", "#b3d0d0", "#9fc3c4", "#e9c7b8", "#e8b59f", "#e8a185", "#e8896a", "#d77656", "#c4603f", "#a4492a", "#8a3a20"];
const LABELS = ["aucune", "à peine", "légère", "gêne légère", "gêne", "modérée", "marquée", "forte", "très forte", "intense", "insupportable"];

export function PainScale({ value, onChange, name }: { value: number | null; onChange: (v: number) => void; name?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline">
        <span className="text-[13px] font-bold text-ink">Douleur</span>
        <span className="flex-1" />
        {value != null && (
          <b className="text-[13.5px] text-[#a4492a]">
            {value} · {LABELS[value]}
          </b>
        )}
      </div>
      <div className="flex items-center gap-[3px]" role="radiogroup" aria-label="Douleur de 0 à 10">
        {COLORS.map((c, n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Douleur ${n}`}
              onClick={() => onChange(n)}
              className="flex flex-1 items-center justify-center rounded-[7px] text-[13px] font-bold transition-all"
              style={{
                height: on ? 40 : 32,
                background: c,
                color: n >= 6 ? "#ffffff" : "#182220",
                outline: on ? "3px solid #182220" : "none",
                outlineOffset: 2,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[11.5px] text-slate">
        <span>Aucune</span>
        <span>Insupportable</span>
      </div>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
    </div>
  );
}
