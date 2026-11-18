import { Fragment } from "react";

// Liens cliquables dans les textes d'une séance (consignes, consignes
// d'exercice, commentaires, notes). Le coach colle simplement une adresse
// — « https://youtu.be/… », « www.strava.com/… » — ou écrit
// « [titre](https://…) » pour un lien avec un titre. Seuls les liens web
// (http/https) sont rendus cliquables ; ils s'ouvrent dans un nouvel onglet.

/** Adresse web sûre (http/https), ou null. Ajoute https:// à « www.… ». */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (/^www\./i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Adresse raccourcie pour l'affichage : domaine + début du chemin. */
export function shortUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = (u.pathname + u.search).replace(/\/$/, "");
    return path.length > 1 ? `${host}${path.length > 24 ? `${path.slice(0, 24)}…` : path}` : host;
  } catch {
    return url;
  }
}

const PATTERN = /\[([^\]\n]{1,120})\]\(((?:https?:\/\/|www\.)[^\s)]+)\)|((?:https?:\/\/|www\.)[^\s<>"]+)/gi;
const TRAILING = /[.,;:!?)\]»"']+$/;

export function Linkify({ text, className = "font-semibold text-moss-dark underline decoration-moss/40 underline-offset-2 hover:text-moss break-words" }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const start = m.index ?? 0;
    let raw = m[2] ?? m[3];
    let label = m[1] ?? null;
    let end = start + m[0].length;
    if (!label) {
      // La ponctuation qui suit une adresse ne fait pas partie du lien.
      const trail = raw.match(TRAILING)?.[0] ?? "";
      raw = raw.slice(0, raw.length - trail.length);
      end -= trail.length;
    }
    const url = safeUrl(raw);
    if (!url) continue;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a key={start} href={url} target="_blank" rel="noopener noreferrer" className={className} >
        {label ?? shortUrl(url)}
      </a>
    );
    last = end;
  }
  if (last === 0) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}
