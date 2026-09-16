// Une couleur par athlète, stable dans le temps : sur le calendrier de
// planification, c'est la couleur qui dit DE QUI il s'agit, et le pictogramme
// qui dit QUOI — le nom n'a donc plus besoin d'apparaître dans chaque case.
//
// Palette choisie pour rester distinguable, y compris pour les formes les plus
// courantes de daltonisme : on évite de faire reposer la lecture sur la seule
// opposition rouge/vert en alternant aussi la clarté des teintes.
export const ATHLETE_COLORS = [
  "#1B4B4F", // vert pétrole
  "#E8896A", // corail
  "#6B7A8A", // ardoise
  "#B08A3E", // ocre
  "#7C5C46", // terre
  "#4A6FA5", // bleu
  "#8C5A7D", // prune
  "#3F7A6D", // jade
  "#C2703D", // ambre
  "#5B6660", // gris-vert
];

/**
 * Attribue une couleur à chaque athlète selon son rang dans la liste fournie.
 * Passer la liste triée de façon stable (comme celle renvoyée par
 * getAthletesForCoach) garantit qu'un athlète garde la même couleur d'une
 * visite à l'autre — une couleur qui change n'apprend rien au coach.
 */
export function buildAthleteColorMap(athleteIds: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  athleteIds.forEach((id, i) => {
    map[id] = ATHLETE_COLORS[i % ATHLETE_COLORS.length];
  });
  return map;
}
