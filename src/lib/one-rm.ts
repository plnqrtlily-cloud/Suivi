/** 1RM estimé (formule d'Epley, arrondi à 2,5 kg) à partir d'une charge et d'un nombre de répétitions. */
export function estimateOneRm(kg: number, reps: number | null | undefined): number {
  if (!reps || reps <= 1) return kg;
  return Math.round((kg * (1 + reps / 30)) / 2.5) * 2.5;
}
