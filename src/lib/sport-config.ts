// Ce qui a du sens de prescrire varie selon le sport : une distance en mètres
// pour la natation, des kilomètres et une puissance pour le vélo, une allure
// pour la course. Plutôt que d'afficher tous les champs partout, chaque sport
// déclare ce qui le concerne — même logique que TrainingPeaks / Garmin
// Connect, qui adaptent l'éditeur au type d'activité.

export type TargetKind = "pace_zone" | "hr_zone" | "power_zone" | "free";
export type DurationKind = "time" | "distance" | "manual";

export interface SportConfig {
  /** Cibles d'intensité pertinentes, la première servant de défaut. */
  targets: TargetKind[];
  /** Unités de durée proposées. */
  durations: DurationKind[];
  /** Unité de distance affichée (m pour la natation, km ailleurs). */
  distanceUnit: "m" | "km";
  /** Champs de volume proposés sur la séance entière. */
  volumeFields: { name: string; label: string; unit: string }[];
  /** Modèles de structure prêts à l'emploi. */
  templates: { label: string; description: string }[];
}

const ENDURANCE_TEMPLATES = [
  { label: "Séance simple", description: "Échauffement, corps de séance continu, retour au calme" },
  { label: "Fractionné", description: "Échauffement, série répétée effort/récupération, retour au calme" },
  { label: "Sortie longue", description: "Échauffement court puis effort continu prolongé" },
];

export const SPORT_CONFIGS: Record<string, SportConfig> = {
  running: {
    targets: ["pace_zone", "hr_zone", "free"],
    durations: ["time", "distance", "manual"],
    distanceUnit: "km",
    volumeFields: [
      { name: "distanceKm", label: "Distance totale", unit: "km" },
      { name: "elevationM", label: "Dénivelé positif", unit: "m" },
    ],
    templates: ENDURANCE_TEMPLATES,
  },
  cycling: {
    targets: ["power_zone", "hr_zone", "free"],
    durations: ["time", "distance", "manual"],
    distanceUnit: "km",
    volumeFields: [
      { name: "distanceKm", label: "Distance totale", unit: "km" },
      { name: "elevationM", label: "Dénivelé positif", unit: "m" },
    ],
    templates: ENDURANCE_TEMPLATES,
  },
  swimming: {
    targets: ["pace_zone", "free"],
    durations: ["distance", "time", "manual"],
    // La natation se prescrit en mètres (longueurs de bassin), pas en km.
    distanceUnit: "m",
    volumeFields: [{ name: "distanceM", label: "Distance totale", unit: "m" }],
    templates: [
      { label: "Séance simple", description: "Échauffement, corps de séance, retour au calme" },
      { label: "Série fractionnée", description: "Échauffement, séries répétées avec temps de repos, retour au calme" },
      { label: "Technique", description: "Échauffement, éducatifs, nage complète, retour au calme" },
    ],
  },
  hiking: {
    targets: ["hr_zone", "free"],
    durations: ["time", "distance", "manual"],
    distanceUnit: "km",
    volumeFields: [
      { name: "distanceKm", label: "Distance totale", unit: "km" },
      { name: "elevationM", label: "Dénivelé positif", unit: "m" },
    ],
    templates: [{ label: "Sortie", description: "Marche d'approche, effort principal, retour" }],
  },
  climbing: {
    targets: ["free"],
    durations: ["time", "manual"],
    distanceUnit: "m",
    volumeFields: [{ name: "routesCount", label: "Nombre de voies/blocs", unit: "" }],
    templates: [
      { label: "Séance simple", description: "Échauffement, voies/blocs, retour au calme" },
      { label: "Séance à thème", description: "Échauffement, travail spécifique répété, retour au calme" },
    ],
  },
  other: {
    targets: ["hr_zone", "free"],
    durations: ["time", "distance", "manual"],
    distanceUnit: "km",
    volumeFields: [{ name: "distanceKm", label: "Distance totale", unit: "km" }],
    templates: [{ label: "Séance simple", description: "Échauffement, corps de séance, retour au calme" }],
  },
};

export function sportConfig(sport: string): SportConfig {
  return SPORT_CONFIGS[sport] ?? SPORT_CONFIGS.other;
}

// Structures pré-remplies correspondant aux modèles ci-dessus. Le coach part
// d'une base cohérente plutôt que d'une page vide, puis ajuste — c'est ce que
// proposent les "block templates" de TrainingPeaks.
export function templateStructure(sport: string, templateLabel: string) {
  const cfg = sportConfig(sport);
  const defaultTarget = cfg.targets[0];
  const isSwim = sport === "swimming";
  const mk = (stepType: string, durationType: string, durationValue: string, targetType: string, zone?: number) => ({
    id: crypto.randomUUID(),
    kind: "step" as const,
    stepType,
    durationType,
    durationValue,
    target: zone ? { type: targetType, zone } : { type: "none" },
  });

  if (templateLabel === "Fractionné" || templateLabel === "Série fractionnée") {
    return [
      mk("warmup", isSwim ? "distance" : "time", isSwim ? "400" : "15:00", defaultTarget, 2),
      {
        id: crypto.randomUUID(),
        kind: "repeat" as const,
        count: isSwim ? 8 : 6,
        steps: [
          mk("work", "distance", isSwim ? "50" : "400", defaultTarget, 4),
          mk("recovery", "time", isSwim ? "00:20" : "01:30", "none"),
        ],
      },
      mk("cooldown", isSwim ? "distance" : "time", isSwim ? "200" : "10:00", defaultTarget, 1),
    ];
  }

  if (templateLabel === "Sortie longue") {
    return [
      mk("warmup", "time", "10:00", defaultTarget, 1),
      mk("work", "time", "90:00", defaultTarget, 2),
      mk("cooldown", "time", "10:00", defaultTarget, 1),
    ];
  }

  if (templateLabel === "Technique") {
    return [
      mk("warmup", "distance", "300", defaultTarget, 2),
      { id: crypto.randomUUID(), kind: "repeat" as const, count: 4, steps: [mk("work", "distance", "50", "none")] },
      mk("work", "distance", "400", defaultTarget, 3),
      mk("cooldown", "distance", "200", defaultTarget, 1),
    ];
  }

  if (templateLabel === "Séance à thème") {
    return [
      mk("warmup", "time", "15:00", "none"),
      { id: crypto.randomUUID(), kind: "repeat" as const, count: 5, steps: [mk("work", "manual", "", "none"), mk("recovery", "time", "03:00", "none")] },
      mk("cooldown", "time", "10:00", "none"),
    ];
  }

  // "Séance simple" et "Sortie" : échauffement / corps / retour au calme.
  return [
    mk("warmup", isSwim ? "distance" : "time", isSwim ? "300" : "15:00", defaultTarget, 2),
    mk("work", isSwim ? "distance" : "time", isSwim ? "800" : "40:00", defaultTarget, 3),
    mk("cooldown", isSwim ? "distance" : "time", isSwim ? "200" : "10:00", defaultTarget, 1),
  ];
}
