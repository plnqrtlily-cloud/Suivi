// Tracés d'icônes par sport, partagés entre le bilan d'entraînement et le
// calendrier — extrait ici pour éviter la duplication entre les deux usages.
export const SPORT_ICON_PATHS: Record<string, string> = {
  running: "M13 4a1.6 1.6 0 100-3.2A1.6 1.6 0 0013 4zM7 18l2-5 3 1 2-5-3-2-2 2-3-1",
  cycling: "M5.5 14.5l3-6.5h4l2.5 4.5h2M8.5 8h2",
  hiking: "M2 16l5-9 3 5 2-3 6 7H2z",
  swimming: "M2 15c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0",
  climbing: "M2 17l6-12 4 7 2-3 4 8H2z",
  strength: "M4 10v4M2 9v6M16 9v6M18 10v4M6 12h10",
};

export function sportIconPath(sport: string): string {
  return SPORT_ICON_PATHS[sport] || "M10 2v16M2 10h16";
}
