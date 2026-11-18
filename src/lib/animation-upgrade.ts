import { dbAll, dbRun } from "./db";
import { EXERCISE_ANIMATIONS, bundledPath, isOutdatedAnimation } from "./exercise-animations";

// Animations refaites depuis leur import (nouvelle ANIMATIONS_REVISION, ou
// exercice changé comme « Cou en isométrie ») : remplacées automatiquement dans
// la bibliothèque du coach, sans qu'il ait à le demander. Le fichier pointe alors vers
// l'animation livrée avec l'application (« bundled:… », servie par
// /api/resources/file/[id]) : rien à téléverser, une simple mise à jour en base.
const TITLES = EXERCISE_ANIMATIONS.map((a) => a.title);

export async function upgradeOutdatedAnimations(coachId: string): Promise<number> {
  if (!TITLES.length) return 0;
  const rows = await dbAll<{ id: string; title: string; description: string | null; file_path: string | null }>(
    `SELECT id, title, description, file_path FROM resources WHERE coach_id = ? AND title IN (${TITLES.map(() => "?").join(",")})`,
    [coachId, ...TITLES]
  );
  let n = 0;
  for (const a of EXERCISE_ANIMATIONS) {
    for (const r of rows.filter((r) => isOutdatedAnimation(a, r))) {
      await dbRun(`UPDATE resources SET file_path = ?, mime_type = 'image/gif', description = ? WHERE id = ? AND coach_id = ?`, [
        bundledPath(a),
        a.description,
        r.id,
        coachId,
      ]);
      n++;
    }
  }
  return n;
}

/** Nom de fichier d'une animation livrée, si ce chemin y renvoie. */
export { bundledFileOf as bundledAnimationFile } from "./exercise-animations";
