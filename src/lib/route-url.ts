// Lien d'un parcours (Strava, Komoot, Trailforks, Garmin…) saisi à la main.
// Seules les adresses web sont gardées ; « komoot.com/tour/1 » devient
// « https://komoot.com/tour/1 ».
export function cleanRouteUrl(v: unknown): string | null {
  let s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString().slice(0, 600);
  } catch {
    return null;
  }
}

/** Sports où un parcours, un D+ ou un temps total ont du sens. */
export const OUTDOOR_SPORTS = ["mtb", "cycling", "running", "hiking", "trail"];
