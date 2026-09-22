// Petits helpers de calendrier partagés entre la page d'accueil (widget jour)
// et la page Programmation (vues semaine/mois) — pour ne pas dupliquer le
// calcul du lundi de la semaine à plusieurs endroits.

// Formate la date LOCALE d'un Date en "YYYY-MM-DD" — jamais via toISOString(),
// qui convertit en UTC et décale le jour d'un cran dès que l'heure locale est
// en avance sur UTC (ex. minuit CEST = 22h UTC la veille) : un vrai bug déjà
// rencontré sur la grille du mois (le "11" affiché comme aujourd'hui au lieu
// du "12", ou inversement selon l'heure).
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

// Nombre de jours calendaires entre aujourd'hui et une date "YYYY-MM-DD" (peut
// être négatif si la date est passée) — calculé en UTC pur sur les seuls
// composants Y/M/D pour ne jamais être affecté par un changement d'heure
// (DST) entre les deux dates, contrairement à une simple soustraction de Date.
export function daysUntil(dateISO: string): number {
  const [ty, tm, td] = todayISO().split("-").map(Number);
  const [y, m, d] = dateISO.split("-").map(Number);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / msPerDay);
}

export function getWeekDates(offsetWeeks: number): string[] {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toISODate(d);
  });
}

export interface MonthCell {
  date: string; // ISO
  day: number;
  inMonth: boolean;
}

// Grille lundi-dimanche complète couvrant le mois donné (year, month 1-indexé),
// avec les jours des mois adjacents nécessaires pour compléter la première et
// la dernière semaine (marqués inMonth: false).
export function getMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);

  const firstDow = first.getDay(); // 0 = dimanche
  const leading = firstDow === 0 ? 6 : firstDow - 1;
  const start = new Date(first);
  start.setDate(first.getDate() - leading);

  const lastDow = last.getDay();
  const trailing = lastDow === 0 ? 0 : 7 - lastDow;
  const end = new Date(last);
  end.setDate(last.getDate() + trailing);

  const cells: MonthCell[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    cells.push({
      date: toISODate(cursor),
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === month - 1,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Fenêtres du bilan d'entraînement
// ---------------------------------------------------------------------------
// Le bilan ne se contentait que de fenêtres glissantes finissant aujourd'hui,
// ce qui rendait impossible de revoir *une* semaine précise. On ancre donc
// chaque période sur une date, et on cale la fenêtre sur des bornes lisibles :
// semaine = lundi→dimanche, mois = 1er→dernier jour, cycle (4 sem.) et bloc
// (12 sem.) = multiples de semaines finissant le dimanche de la semaine ancre.
// Naviguer revient alors à décaler l'ancre d'exactement une période.

export type BilanPeriodValue = "jour" | "semaine" | "cycle" | "mois" | "bloc";

export interface BilanWindow {
  from: string; // ISO inclusif
  to: string; // ISO inclusif
  days: number;
  label: string;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function mondayOf(iso: string): string {
  const d = parseISO(iso);
  const dow = d.getDay(); // 0 = dimanche
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return toISODate(d);
}

function shortFR(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function computeBilanWindow(period: BilanPeriodValue, anchorISO: string): BilanWindow {
  if (period === "jour") {
    const d = parseISO(anchorISO);
    return {
      from: anchorISO,
      to: anchorISO,
      days: 1,
      label: d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    };
  }

  if (period === "mois") {
    const d = parseISO(anchorISO);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const from = toISODate(first);
    const to = toISODate(last);
    return {
      from,
      to,
      days: last.getDate(),
      label: monthLabel(d.getFullYear(), d.getMonth() + 1),
    };
  }

  const weeks = period === "semaine" ? 1 : period === "cycle" ? 4 : 12;
  const endMonday = mondayOf(anchorISO);
  const from = addDays(endMonday, -7 * (weeks - 1));
  const to = addDays(endMonday, 6);
  const days = weeks * 7;
  const label =
    period === "semaine"
      ? `Semaine du ${shortFR(from)} au ${shortFR(to)}`
      : `${weeks} semaines — du ${shortFR(from)} au ${shortFR(to)}`;
  return { from, to, days, label };
}

// Ancre de la période précédente / suivante : on recule ou avance d'exactement
// la durée de la fenêtre courante, pour que « ‹ » depuis la semaine du 15
// tombe sur celle du 8 et non sur un lundi intermédiaire.
export function shiftBilanAnchor(period: BilanPeriodValue, anchorISO: string, direction: -1 | 1): string {
  if (period === "jour") return addDays(anchorISO, direction);
  if (period === "mois") {
    const d = parseISO(anchorISO);
    // Le 1er du mois évite le débordement du 31 vers le mois suivant.
    return toISODate(new Date(d.getFullYear(), d.getMonth() + direction, 1));
  }
  const weeks = period === "semaine" ? 1 : period === "cycle" ? 4 : 12;
  return addDays(anchorISO, direction * weeks * 7);
}

/** Nombre de jours inclusifs d'une plage de bilan choisie librement. */
export function bilanRangeDays(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split("-").map(Number);
  const [y2, m2, d2] = toISO.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1;
}
