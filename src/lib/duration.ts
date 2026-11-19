// Durées écrites librement, par l'athlète comme par le coach : « 45 », « 45 min »,
// « 1h », « 1h30 », « 1 h 30 », « 1:30 », « 1,5 h », « 2 heures », « 90 min ».
// Un nombre seul se lit en minutes (45 → 45 min), sauf un petit nombre (moins
// de 10) qui se lit en heures (2 → 2 h) : une séance de 2 minutes n'existe pas.
// Affichage : en minutes sous 1 h (« 45 min »), en heures au-delà (« 1 h 30 »).

/** Minutes correspondant au texte, ou null si le texte n'est pas une durée. */
export function parseDuration(text: string | null | undefined): number | null {
  if (text == null) return null;
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  let m: RegExpMatchArray | null;
  // 1:30
  if ((m = t.match(/^(\d{1,2}):(\d{1,2})$/))) return Number(m[1]) * 60 + Number(m[2]);
  // 1h, 1 h 30, 1h30min, 1 heure 15, 2 heures, 1.5h
  if ((m = t.match(/^(\d+(?:\.\d+)?) ?(?:h|hr|hrs|heures?)(?: ?(\d{1,2}) ?(?:min|mn|m|minutes?)?)?$/))) {
    const h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    return Math.round(h * 60 + min);
  }
  // 45 min, 45mn, 45 minutes, 45'
  if ((m = t.match(/^(\d+(?:\.\d+)?) ?(?:min|mn|m|minutes?|')$/))) return Math.round(Number(m[1]));
  // Nombre seul : minutes, ou heures pour un petit nombre (< 10).
  if ((m = t.match(/^(\d+(?:\.\d+)?)$/))) {
    const n = Number(m[1]);
    return n < 10 ? Math.round(n * 60) : Math.round(n);
  }
  return null;
}

/** « 45 min », « 1 h », « 1 h 30 ». */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "";
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}
