// Enrobe une navigation dans l'API View Transitions du navigateur (fondu
// enchaîné natif) quand elle est disponible, sinon exécute la navigation telle
// quelle. Les promesses exposées par ViewTransition (ready/finished) peuvent
// se rejeter avec "InvalidStateError" quand un geste rapproché (molette,
// swipe) déclenche une deuxième transition avant que la première soit
// retombée — la navigation elle-même a déjà eu lieu dans ce cas, seul l'effet
// visuel est écourté, donc on avale l'erreur plutôt que de la laisser remonter
// en rejet de promesse non intercepté.
export function navigateWithTransition(run: () => void) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition !== "function") {
    run();
    return;
  }
  const transition = doc.startViewTransition(run);
  transition.finished.catch(() => {});
}
