import type { RoutePoint } from "@/lib/gpx";

const WIDTH = 320;
const HEIGHT = 170;
const PAD = 14;

// Tracé du parcours en SVG pur — pas de fond de carte (aucune dépendance à un
// service de tuiles ni de clé API), juste la forme du trajet à l'échelle,
// projetée en équirectangulaire (suffisant vu l'étendue d'une sortie locale)
// et redimensionnée pour remplir le cadre.
export function RouteMap({ points }: { points: RoutePoint[] }) {
  if (points.length < 2) return null;

  const avgLatRad = (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
  const cosLat = Math.cos(avgLatRad);
  const projected = points.map((p) => ({ x: p.lng * cosLat, y: -p.lat }));

  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 0.0001;
  const spanY = maxY - minY || 0.0001;

  const scale = Math.min((WIDTH - PAD * 2) / spanX, (HEIGHT - PAD * 2) / spanY);
  const offsetX = (WIDTH - spanX * scale) / 2;
  const offsetY = (HEIGHT - spanY * scale) / 2;

  const svgPoints = projected.map((p) => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (p.y - minY) * scale,
  }));
  const path = svgPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const start = svgPoints[0];
  const end = svgPoints[svgPoints.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full rounded-xl bg-paper-dim" role="img" aria-label="Tracé du parcours">
      <path d={path} fill="none" stroke="#1B4B4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={start.x} cy={start.y} r="4.5" fill="#1B4B4F" stroke="white" strokeWidth="1.5" />
      <circle cx={end.x} cy={end.y} r="4.5" fill="#7C5C46" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}
