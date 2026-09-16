// Libellés de sport en texte pur, sans dépendance à React — utilisables dans
// une route API ou un générateur de fichier, là où importer un composant
// entraînerait tout le rendu côté client dans le bundle serveur.
export const SPORT_LABELS_PLAIN: Record<string, string> = {
  running: "Course à pied",
  cycling: "Vélo",
  hiking: "Randonnée",
  swimming: "Natation",
  climbing: "Escalade",
  strength: "Musculation",
  other: "Divers",
};

export function sportLabelPlain(sport: string): string {
  return SPORT_LABELS_PLAIN[sport] || sport;
}
