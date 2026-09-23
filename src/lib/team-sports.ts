// Sports collectifs (v1) : liste figée à ces 4 sports — pas de mécanisme
// d'extension prévu ici, à la différence de sport-config.ts qui liste des
// sports individuels sans rapport avec ce fichier. Rugby et basketball
// couvrent toutes leurs variantes (union/league/sevens, 5x5/3x3) avec un seul
// référentiel de postes chacun.
export type TeamSport = "football" | "rugby" | "handball" | "basketball";

export interface PositionDef {
  value: string;
  label: string;
  /** Bande occupée sur l'axe d'attaque (0 = but/panier propre, 100 = adverse),
   * en pourcentage de la longueur du terrain. Sert uniquement à un
   * positionnement illustratif large (postes larges, pas une position
   * tactique précise). */
  band: [number, number];
}

export interface TeamSportConfig {
  label: string;
  positions: PositionDef[];
}

export const TEAM_SPORTS: Record<TeamSport, TeamSportConfig> = {
  football: {
    label: "Football",
    positions: [
      { value: "gardien", label: "Gardien", band: [3, 12] },
      { value: "defenseur", label: "Défenseur", band: [18, 35] },
      { value: "milieu", label: "Milieu", band: [42, 60] },
      { value: "attaquant", label: "Attaquant", band: [68, 90] },
    ],
  },
  rugby: {
    label: "Rugby",
    positions: [
      { value: "avant", label: "Avant", band: [8, 25] },
      { value: "demi", label: "Demi (charnière)", band: [32, 45] },
      { value: "trois_quart", label: "Trois-quarts", band: [50, 70] },
      { value: "arriere", label: "Arrière", band: [78, 92] },
    ],
  },
  handball: {
    label: "Handball",
    positions: [
      { value: "gardien", label: "Gardien", band: [3, 12] },
      { value: "arriere", label: "Arrière", band: [50, 65] },
      { value: "ailier", label: "Ailier", band: [72, 85] },
      { value: "pivot", label: "Pivot", band: [80, 92] },
    ],
  },
  basketball: {
    label: "Basketball",
    positions: [
      { value: "meneur", label: "Meneur", band: [35, 50] },
      { value: "arriere", label: "Arrière", band: [45, 60] },
      { value: "ailier", label: "Ailier", band: [55, 68] },
      { value: "ailier_fort", label: "Ailier fort", band: [65, 80] },
      { value: "pivot", label: "Pivot", band: [75, 92] },
    ],
  },
};

export const TEAM_SPORT_VALUES = Object.keys(TEAM_SPORTS) as TeamSport[];

export function isTeamSport(value: string): value is TeamSport {
  return value in TEAM_SPORTS;
}

export function isValidPosition(sport: TeamSport, position: string): boolean {
  return TEAM_SPORTS[sport].positions.some((p) => p.value === position);
}

export function positionLabel(sport: TeamSport, position: string): string {
  return TEAM_SPORTS[sport].positions.find((p) => p.value === position)?.label ?? position;
}

/** Répartit `count` joueurs occupant le même poste dans sa bande [xMin,xMax] :
 * espacés verticalement de façon régulière entre 12% et 88% (marge des lignes
 * de touche), avec un léger zig-zag horizontal (± un quart de la largeur de
 * bande) à partir de 3 joueurs pour éviter un alignement parfaitement vertical. */
export function layoutBand(band: [number, number], count: number): { xPct: number; yPct: number }[] {
  if (count <= 0) return [];
  const [xMin, xMax] = band;
  const xMid = (xMin + xMax) / 2;
  const xJitter = count > 2 ? (xMax - xMin) / 4 : 0;
  const yMin = 12;
  const yMax = 88;
  return Array.from({ length: count }, (_, i) => ({
    xPct: xMid + (i % 2 === 0 ? -xJitter : xJitter),
    yPct: count === 1 ? 50 : yMin + ((yMax - yMin) * i) / (count - 1),
  }));
}
