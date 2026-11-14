// Résumé intelligent d'un entretien coach/athlète : à partir de la
// transcription, l'IA (API Anthropic) rédige un résumé structuré et repère
// les infos à reporter au profil (sports, genre, mesures, charges, antécédents).
// Rien n'est enregistré au profil sans validation du coach.
import { PERFORMANCE_METRICS } from "./performance-metrics";

export const SPORT_KEYS = ["cycling", "running", "hiking", "swimming", "climbing", "strength", "other"] as const;
export const GENDER_KEYS = ["female", "male", "other", "prefer_not_to_say"] as const;

export interface InterviewSummary {
  resume: string;
  profil: { contexte?: string; objectifs?: string; contraintes?: string; points_forts?: string; points_faibles?: string };
  sports: string[];
  sports_detail?: string;
  genre: string | null;
  mesures: { metric: string; value: number; label?: string }[];
  charges: { exercice: string; kg?: number | null; reps?: number | null; secondes?: number | null }[];
  antecedents: { zone: string; description?: string; date_debut?: string | null; date_fin?: string | null; a_surveiller?: string }[];
  a_suivre: string[];
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export function aiAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function prompt(transcript: string, firstName: string, today: string) {
  const metrics = PERFORMANCE_METRICS.map((m) => `${m.value} = ${m.label}${m.unit ? ` (${m.unit})` : ""}`).join("\n");
  return `Tu assistes un coach sportif (préparation physique, VTT, endurance). Voici la transcription brute d'un entretien de départ avec son athlète ${firstName} (dictée automatique : il peut y avoir des fautes, des mots mal reconnus et des répétitions). Date du jour : ${today}.

<transcription>
${transcript}
</transcription>

Rédige un résumé utile au coach et repère les informations à reporter dans le profil de l'athlète. N'invente rien : ce qui n'est pas dit clairement reste vide. Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, de cette forme :
{
  "resume": "5 à 10 phrases claires en français : qui est l'athlète, son niveau, son historique, ses objectifs, ses contraintes, ce qu'il faut retenir",
  "profil": {
    "contexte": "situation, historique sportif, mode de vie, disponibilités",
    "objectifs": "objectifs et échéances",
    "contraintes": "contraintes (temps, matériel, travail, santé)",
    "points_forts": "...",
    "points_faibles": "..."
  },
  "sports": [clés parmi ${SPORT_KEYS.join(", ")} ; VTT/vélo = cycling, trail/course = running, muscu/renfo = strength],
  "sports_detail": "précision libre (ex. VTT enduro et DH)",
  "genre": une clé parmi ${GENDER_KEYS.join(", ")} seulement si c'est clair, sinon null,
  "mesures": [{"metric": "clé de la liste ci-dessous", "value": nombre}] uniquement pour des valeurs chiffrées dites dans l'entretien,
  "charges": [{"exercice": "Squat", "kg": 80, "reps": 5, "secondes": null}] (reps = répétitions faites à cette charge ; secondes pour un exercice tenu en temps),
  "antecedents": [{"zone": "Genou droit", "description": "...", "date_debut": "AAAA-MM-JJ ou AAAA-MM si connu, sinon null", "date_fin": "... ou null", "a_surveiller": "conseil concret pour l'athlète"}],
  "a_suivre": ["points à creuser ou à vérifier par le coach"]
}

Clés de mesures possibles :
${metrics}`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Réponse illisible.");
  return JSON.parse(text.slice(start, end + 1));
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && !Number.isNaN(Number(v.replace(",", "."))) ? Number(v.replace(",", ".")) : null);

// On ne garde que ce qui est exploitable (clés connues, nombres valides).
export function cleanSummary(raw: unknown): InterviewSummary {
  const r = (raw ?? {}) as Record<string, unknown>;
  const p = (r.profil ?? {}) as Record<string, unknown>;
  const metricKeys = new Set(PERFORMANCE_METRICS.map((m) => m.value));
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    resume: str(r.resume) ?? "",
    profil: { contexte: str(p.contexte), objectifs: str(p.objectifs), contraintes: str(p.contraintes), points_forts: str(p.points_forts), points_faibles: str(p.points_faibles) },
    sports: arr(r.sports).map(String).filter((s): s is string => (SPORT_KEYS as readonly string[]).includes(s)),
    sports_detail: str(r.sports_detail),
    genre: typeof r.genre === "string" && (GENDER_KEYS as readonly string[]).includes(r.genre) ? r.genre : null,
    mesures: arr(r.mesures)
      .map((m) => m as Record<string, unknown>)
      .filter((m) => typeof m.metric === "string" && metricKeys.has(m.metric) && num(m.value) !== null)
      .map((m) => ({ metric: String(m.metric), value: num(m.value) as number, label: PERFORMANCE_METRICS.find((x) => x.value === m.metric)?.label })),
    charges: arr(r.charges)
      .map((c) => c as Record<string, unknown>)
      .filter((c) => str(c.exercice) && (num(c.kg) !== null || num(c.secondes) !== null))
      .map((c) => ({ exercice: str(c.exercice) as string, kg: num(c.kg), reps: num(c.reps), secondes: num(c.secondes) })),
    antecedents: arr(r.antecedents)
      .map((a) => a as Record<string, unknown>)
      .filter((a) => str(a.zone))
      .map((a) => ({ zone: str(a.zone) as string, description: str(a.description), date_debut: str(a.date_debut) ?? null, date_fin: str(a.date_fin) ?? null, a_surveiller: str(a.a_surveiller) })),
    a_suivre: arr(r.a_suivre).map((x) => String(x)).filter(Boolean),
  };
}

export async function summarizeInterview(transcript: string, firstName: string, today: string): Promise<InterviewSummary> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Le résumé automatique n'est pas encore activé (clé API manquante).");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt(transcript, firstName, today) }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[entretien] API", res.status, body.slice(0, 300));
    throw new Error("Le résumé n'a pas pu être fait pour l'instant. La transcription est enregistrée : réessaie plus tard.");
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return cleanSummary(extractJson(text));
}
