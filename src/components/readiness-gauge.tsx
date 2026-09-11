// Jauge circulaire pour la forme du jour — cercle de fond translucide + arc
// coloré proportionnel au score, dessiné en SVG pur (pas de dépendance externe).
export function ReadinessGauge({
  score,
  size = 96,
  trackColor = "rgba(255,255,255,0.14)",
  fillColor = "#DCAF57",
  labelColor = "#fff",
  sublabelColor = "rgba(255,255,255,0.5)",
}: {
  score: number;
  size?: number;
  trackColor?: string;
  fillColor?: string;
  labelColor?: string;
  sublabelColor?: string;
}) {
  const r = 58;
  const circumference = 2 * Math.PI * r;
  const fraction = Math.max(0, Math.min(1, score / 10));
  const dashoffset = circumference * (1 - fraction);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke={trackColor} strokeWidth="11" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={fillColor}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold leading-none" style={{ color: labelColor }}>
          {score}
        </span>
        <span className="mt-0.5 text-[10px]" style={{ color: sublabelColor }}>
          sur 10
        </span>
      </div>
    </div>
  );
}
