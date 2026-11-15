// Utilitaires de jours sans dépendance client : utilisables par les actions
// serveur comme par les composants.

function nextISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + 1));
  return x.toISOString().slice(0, 10);
}

/** Regroupe des jours en suites consécutives : [["2026-11-20","2026-11-22"], ["2026-11-25","2026-11-25"]]. */
export function consecutiveRuns(dates: string[]): [string, string][] {
  const runs: [string, string][] = [];
  for (const d of [...new Set(dates)].sort()) {
    const last = runs[runs.length - 1];
    if (last && nextISO(last[1]) === d) last[1] = d;
    else runs.push([d, d]);
  }
  return runs;
}
