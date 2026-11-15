// Note d'entretien du coach : reprise des anciennes rubriques en texte mis en forme.
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ESC[c]);

export function legacyInterviewHtml(n: { context?: string | null; objectives?: string | null; constraints?: string | null; strengths?: string | null; weaknesses?: string | null } | null | undefined) {
  if (!n) return "";
  const parts = [
    ["Contexte et parcours sportif", n.context],
    ["Objectifs et échéances", n.objectives],
    ["Disponibilités et contraintes", n.constraints],
    ["Points forts", n.strengths],
    ["Points faibles", n.weaknesses],
  ].filter(([, v]) => v && v.trim()) as [string, string][];
  return parts.map(([t, v]) => `<h3>${esc(t)}</h3>${v.split(/\n+/).map((l) => `<p>${esc(l)}</p>`).join("")}`).join("");
}

