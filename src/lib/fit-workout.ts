import { Encoder, Profile } from "@garmin/fitsdk";
import type { FileIdMesg, WorkoutMesg, WorkoutStepMesg } from "@garmin/fitsdk";

// Export d'une séance en fichier .FIT "workout", au format que les montres
// Garmin savent afficher sous Entraînement > Entraînements — importable en
// copiant le fichier dans le dossier NEWFILES (ou WORKOUTS) de la montre une
// fois connectée en USB. Contrairement à un import d'activité, Garmin Connect
// n'a pas de bouton "importer un entraînement" sur son site : ce transfert
// manuel vers l'appareil est la seule voie sans passer par un partenariat API
// (cf. la méthode que documente TrainingPeaks pour le même besoin).
const SPORT_MAP: Record<string, string> = {
  running: "running",
  cycling: "cycling",
  hiking: "walking",
  swimming: "swimming",
  climbing: "training",
  strength: "training",
};

export interface FitWorkoutInput {
  title: string;
  sport: string;
  durationMinutes: number | null;
}

export function buildFitWorkout(workout: FitWorkoutInput): Uint8Array {
  const encoder = new Encoder();
  const sport = SPORT_MAP[workout.sport] || "generic";
  // Les noms affichés sur l'écran d'une montre sont courts — tronqués pour
  // éviter qu'ils soient coupés au milieu d'un mot sur l'appareil.
  const name = workout.title.slice(0, 30);

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.FILE_ID,
    type: "workout",
    manufacturer: "development",
    product: 0,
    serialNumber: 1,
    timeCreated: new Date(),
  } as FileIdMesg & { mesgNum: number });

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.WORKOUT,
    sport,
    numValidSteps: 1,
    wktName: name,
  } as WorkoutMesg & { mesgNum: number });

  const durationSeconds = Math.max(60, (workout.durationMinutes || 30) * 60);

  encoder.writeMesg({
    mesgNum: Profile.MesgNum.WORKOUT_STEP,
    messageIndex: 0,
    wktStepName: name,
    durationType: "time",
    // Champ brut non re-mis à l'échelle à l'écriture (contrairement au sous-champ
    // "durationTime" utilisé côté lecture) : unité milliseconde directement.
    durationValue: durationSeconds * 1000,
    targetType: "open",
    targetValue: 0,
    intensity: "active",
  } as WorkoutStepMesg & { mesgNum: number });

  return encoder.close();
}
