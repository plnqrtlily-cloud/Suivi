// Structure d'une séance (intervals_json) sans ce qui n'a pas été rempli.
// Le formulaire propose d'office échauffement / corps de séance / retour au
// calme : une étape laissée vide (ni durée ni distance, ni consigne écrite)
// veut dire « pas besoin », on ne l'enregistre ni ne l'affiche. Un bloc ou une
// répétition qui ne contient plus rien disparaît aussi. Une étape « libre »
// (au ressenti, choisie exprès) est gardée.

type AnyItem = { kind?: string; durationType?: string; durationValue?: string; target?: { freeText?: string }; steps?: AnyItem[]; items?: AnyItem[] };

function stepFilled(s: AnyItem) {
  return s.durationType === "manual" || !!String(s.durationValue ?? "").trim() || !!s.target?.freeText?.trim();
}

function cleanItems(items: AnyItem[]): AnyItem[] {
  const out: AnyItem[] = [];
  for (const it of items) {
    if (it.kind === "bloc") {
      const inner = cleanItems(it.items ?? []);
      if (inner.length) out.push({ ...it, items: inner });
    } else if (it.kind === "repeat") {
      const steps = (it.steps ?? []).filter(stepFilled);
      if (steps.length) out.push({ ...it, steps });
    } else if (stepFilled(it)) out.push(it);
  }
  return out;
}

/** Structure nettoyée ; tableau vide si rien n'a été rempli. */
export function cleanStructure<T>(items: T[]): T[] {
  return cleanItems(items as unknown as AnyItem[]) as unknown as T[];
}

/** Même chose depuis le JSON stocké : null s'il ne reste rien à montrer. */
export function cleanStructureJson(json: string | null | undefined): string | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return json;
    const kept = cleanItems(parsed);
    return kept.length ? JSON.stringify(kept) : null;
  } catch {
    return json;
  }
}
