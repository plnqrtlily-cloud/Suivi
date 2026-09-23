// Tracés d'icônes par sport, partagés entre le bilan d'entraînement et le
// calendrier — extrait ici pour éviter la duplication entre les deux usages.
// Randonnée et escalade étaient auparavant deux contours de montagne en
// dents de scie quasi identiques : la randonnée est passée à des bâtons de
// randonnée croisés pour lever l'ambiguïté avec l'escalade, qui garde la
// paroi rocheuse mais avec des prises (points) qui lui sont propres.
export const SPORT_ICON_PATHS: Record<string, string> = {
  running:
    "M11.6 3.6a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0 -2.8 0M8 18l1.6-4.6-2.6-1.7.7-3.4 2.8.8 1.3 2.6 3.1-.5 1.7 3.3",
  cycling: "M2 15a3 3 0 1 0 6 0 3 3 0 1 0 -6 0M12 15a3 3 0 1 0 6 0 3 3 0 1 0 -6 0M5 15L9 8L13 8L15 15M9 8L7 8M13 8L14.5 6.5",
  hiking: "M7 2L10 18M15 5L5 15M5.9 2a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0 -2.2 0M13.9 5a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 1 0 -2.2 0",
  swimming: "M2 12c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0M2 16c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0",
  climbing:
    "M2 18l3-15 2 7 2-11 2 13 3-9 3 15zM7 10a.9.9 0 1 0 1.8 0 .9.9 0 1 0 -1.8 0M11 6a.9.9 0 1 0 1.8 0 .9.9 0 1 0 -1.8 0",
  strength: "M4 10v4M2 9v6M16 9v6M18 10v4M6 12h10",
  other: "M10 3v14M4 6l12 8M16 6L4 14",
};

export function sportIconPath(sport: string): string {
  return SPORT_ICON_PATHS[sport] || SPORT_ICON_PATHS.other;
}
