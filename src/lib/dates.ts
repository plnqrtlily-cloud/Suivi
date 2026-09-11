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
