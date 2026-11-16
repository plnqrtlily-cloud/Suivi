// Recherche tolérante (accents, majuscules, ponctuation) et tri alphabétique
// français — partagés par la bibliothèque et le constructeur de séance.

export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tous les mots de la requête doivent se retrouver dans le texte (dans n'importe quel ordre). */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = normalizeSearch(fields.filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
}

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
export function byTitle<T extends { title: string }>(a: T, b: T): number {
  return collator.compare(a.title, b.title);
}
export function alpha(a: string, b: string): number {
  return collator.compare(a, b);
}
