// Extraction minimaliste des points de trace d'un fichier GPX (norme fixe,
// balises <trkpt lat="…" lon="…">) par regex plutôt qu'un vrai parseur XML —
// suffisant ici et évite une dépendance pour un besoin aussi ciblé.
export interface RoutePoint {
  lat: number;
  lng: number;
}

export function parseGpx(xml: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  const trkptRegex = /<trkpt\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = trkptRegex.exec(xml))) {
    const attrs = match[1];
    const latMatch = attrs.match(/\blat="(-?[\d.]+)"/);
    const lonMatch = attrs.match(/\blon="(-?[\d.]+)"/);
    if (latMatch && lonMatch) {
      points.push({ lat: parseFloat(latMatch[1]), lng: parseFloat(lonMatch[1]) });
    }
  }
  return points;
}

// Sous-échantillonnage à pas fixe (pas de simplification géométrique type
// Douglas-Peucker) : une sortie de plusieurs heures peut compter des milliers
// de points, inutile de tous les stocker pour un tracé purement visuel.
export function simplifyRoute(points: RoutePoint[], maxPoints = 300): RoutePoint[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const result: RoutePoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.floor(i * step)]);
  }
  result.push(points[points.length - 1]);
  return result;
}
