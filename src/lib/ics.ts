import type { Workout } from "./queries";
import { sportLabelPlain } from "./sport-labels";

// Génération d'un flux iCalendar (RFC 5545) auquel Google Agenda, Apple
// Calendrier ou Outlook peuvent s'abonner. Le flux est en lecture seule : les
// séances restent modifiables uniquement dans l'application, et les clients
// de calendrier se resynchronisent périodiquement d'eux-mêmes.

// Les caractères ; , et \ ont une signification syntaxique dans le format, et
// les retours à la ligne doivent être échappés — sans ça, une séance dont le
// titre contient une virgule casse le fichier entier.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toICSDate(dateISO: string): string {
  return dateISO.replace(/-/g, "");
}

function toICSDateTime(dateISO: string, time: string): string {
  const [h, m] = time.split(":");
  return `${toICSDate(dateISO)}T${(h || "00").padStart(2, "0")}${(m || "00").padStart(2, "0")}00`;
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMinutes(dateISO: string, time: string, minutes: number): string {
  const [h, m] = time.split(":");
  const d = new Date(`${dateISO}T${(h || "00").padStart(2, "0")}:${(m || "00").padStart(2, "0")}:00`);
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

// Le format impose des lignes de 75 octets maximum, les suivantes étant
// préfixées d'une espace. Peu de clients l'exigent strictement, mais les plus
// stricts rejettent le fichier sans ça.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) chunks.push(` ${rest}`);
  return chunks.join("\r\n");
}

const STATUS_PREFIX: Record<string, string> = {
  done: "✓ ",
  not_done: "✗ ",
  partial: "~ ",
  cancelled: "Annulé — ",
};

export function buildWorkoutsICS(workouts: Workout[], athleteName: string): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const events = workouts.flatMap((w) => {
    if (w.status === "cancelled") return [];

    const prefix = STATUS_PREFIX[w.status] ?? "";
    const summary = `${prefix}${w.title} (${sportLabelPlain(w.sport)})`;

    // Une séance sans heure est un événement "journée entière" : forcer une
    // heure arbitraire la ferait apparaître à 00:00 dans l'agenda.
    const timing = w.time
      ? [
          `DTSTART:${toICSDateTime(w.date, w.time)}`,
          `DTEND:${addMinutes(w.date, w.time, w.duration_minutes || 60)}`,
        ]
      : [
          `DTSTART;VALUE=DATE:${toICSDate(w.date)}`,
          // DTEND est exclusif pour une date seule : +1 jour = la journée même.
          `DTEND;VALUE=DATE:${toICSDate(addDays(w.date, 1))}`,
        ];

    const descriptionParts: string[] = [];
    if (w.description) descriptionParts.push(w.description);
    if (w.duration_minutes) descriptionParts.push(`Durée prévue : ${w.duration_minutes} min`);

    return [
      "BEGIN:VEVENT",
      `UID:${w.id}@rythme`,
      `DTSTAMP:${now}`,
      ...timing,
      foldLine(`SUMMARY:${escapeText(summary)}`),
      ...(descriptionParts.length ? [foldLine(`DESCRIPTION:${escapeText(descriptionParts.join("\n"))}`)] : []),
      "END:VEVENT",
    ];
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rythme//Suivi coach-athlete//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeText(`Entraînements — ${athleteName}`)}`),
    // Indication (non contraignante) de fréquence de rafraîchissement.
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}
