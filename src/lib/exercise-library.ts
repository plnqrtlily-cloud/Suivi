// Bibliothèque d'exercices courants pour l'autocomplétion du constructeur de séances
// (cf. demande : s'inspirer des meilleures apps de suivi de musculation, qui
// proposent toutes une recherche/autocomplétion d'exercice plutôt qu'un champ texte
// libre — cohérence des noms d'un exercice à l'autre, ressaisie plus rapide).
// Liste volontairement pragmatique (mouvements les plus courants en préparation
// physique), pas exhaustive — un coach peut toujours saisir un nom personnalisé.
export const COMMON_EXERCISES = [
  // Bas du corps
  "Squat", "Squat avant", "Squat bulgare", "Soulevé de terre", "Soulevé de terre roumain",
  "Fentes avant", "Fentes arrière", "Hip thrust", "Presse à cuisses", "Leg curl",
  "Leg extension", "Mollets debout", "Mollets assis",
  // Haut du corps - poussée
  "Développé couché", "Développé incliné", "Développé militaire", "Développé haltères",
  "Dips", "Pompes", "Écarté couché", "Élévations latérales",
  // Haut du corps - tirage
  "Tractions", "Rowing barre", "Rowing haltère", "Tirage vertical", "Tirage horizontal",
  "Face pull", "Shrugs",
  // Bras
  "Curl biceps barre", "Curl biceps haltères", "Extension triceps poulie", "Barre au front",
  // Gainage / core
  "Planche", "Planche latérale", "Crunch", "Relevé de jambes", "Russian twist", "Superman",
  // Mobilité / échauffement
  "Rotation des hanches", "Cercles de bras", "Fentes marchées", "Squat au poids du corps",
  "Montées de genoux", "Talons-fesses",
  // Pliométrie
  "Squat jump", "Fentes sautées", "Box jump", "Burpees", "Sauts à la corde",
  // Proprioception
  "Équilibre unipodal", "Équilibre sur coussin instable", "Planche unipodale",
] as const;
