// Contenu d'une séance en lignes de texte lisibles, pour le détail compact du
// calendrier coach (sans dépendance serveur : importable côté client).

const STEP_LABEL: Record<string, string> = {
  warmup: "Échauffement",
  work: "Effort",
  recovery: "Récupération",
  rest: "Repos",
  cooldown: "Retour au calme",
};
const TARGET_LABEL: Record<string, string> = { hr_zone: "FC", pace_zone: "allure", power_zone: "puissance" };

function fmtTime(v: string): string {
  const m = String(v || "").trim().match(/^(\d+):(\d{1,2})$/);
  if (!m) return v;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (min === 0) return `${sec} s`;
  if (sec === 0) return `${min} min`;
  return `${min} min ${String(sec).padStart(2, "0")}`;
}

function fmtDuration(type: string, value: string): string {
  if (type === "manual") return "";
  if (type === "distance") {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 1000) return `${String(n / 1000).replace(".", ",")} km`;
    return value ? `${value} m` : "";
  }
  return value ? fmtTime(value) : "";
}

interface StepLike {
  kind?: string;
  stepType?: string;
  durationType?: string;
  durationValue?: string;
  stroke?: string;
  target?: { type?: string; zone?: number; freeText?: string };
}
interface ItemLike extends StepLike {
  count?: number | string;
  steps?: StepLike[];
  items?: ItemLike[];
  title?: string;
  type?: string;
}
export interface BlockLike {
  id: string;
  block_type: string;
  exercise_name?: string | null;
  circuit_id?: string | null;
  circuit_rounds?: number | null;
  circuit_rest_seconds?: number | null;
  exerciseSets?: { reps?: string | null; load?: string | null; rir?: number | string | null }[];
}

function stepText(step: StepLike): string {
  const d = fmtDuration(step.durationType ?? "", step.durationValue ?? "");
  const type = step.stepType ?? "";
  let t = `${d ? d + " " : ""}${STEP_LABEL[type] ?? type}`.trim();
  if (step.stroke) t += ` ${String(step.stroke).toLowerCase()}`;
  const target = step.target;
  if (target && target.type && target.type !== "none") {
    if (target.type === "free") {
      if (target.freeText) t += ` · ${target.freeText}`;
    } else if (target.zone) {
      t += ` · Z${target.zone} ${TARGET_LABEL[target.type] ?? ""}`.trimEnd();
    }
  }
  return t;
}

export function intervalsToLines(json: string | null | undefined): string[] {
  if (!json) return [];
  let items: ItemLike[];
  try {
    items = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const it of items) {
    if (it && it.kind === "bloc" && Array.isArray(it.items)) {
      out.push(String(it.title || it.type || "Bloc"));
      for (const sub of intervalsToLines(JSON.stringify(it.items))) out.push("    " + sub);
    } else if (it && it.kind === "repeat" && Array.isArray(it.steps)) {
      out.push(`${it.count || 1} × (${it.steps.map(stepText).join(" + ")})`);
    } else if (it) {
      out.push(stepText(it));
    }
  }
  return out;
}

const BLOCK_GROUP: Record<string, string> = {
  warmup_mobility: "Échauffement",
  warmup_plyo: "Échauffement",
  warmup_proprio: "Échauffement",
  main: "Corps de séance",
  secondary: "Corps de séance",
  complementary: "Corps de séance",
  specific: "Corps de séance",
  core: "Gainage",
  cooldown: "Retour au calme",
};

/** Blocs de musculation (workout_blocks + exercise_sets) -> lignes « Série A · 4 tours : A1 Squat × 5 @ 80 % ». */
export function strengthBlocksToLines(blocks: BlockLike[]): string[] {
  const out: string[] = [];
  let group = "";
  let letter = 0;
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    const g = BLOCK_GROUP[b.block_type] ?? "Corps de séance";
    if (g !== group) {
      out.push(g);
      group = g;
    }
    const cid = b.circuit_id || b.id;
    const members: BlockLike[] = [];
    while (i < blocks.length && (blocks[i].circuit_id || blocks[i].id) === cid && (BLOCK_GROUP[blocks[i].block_type] ?? "Corps de séance") === g) {
      members.push(blocks[i]);
      i++;
    }
    const L = String.fromCharCode(65 + letter++);
    const rounds = members[0].circuit_rounds || 1;
    const rest = members[0].circuit_rest_seconds ? `, récup ${fmtRest(members[0].circuit_rest_seconds)}` : "";
    const ex = members
      .map((m, k) => {
        const s0 = (m.exerciseSets || [])[0] || {};
        let t = `${L}${k + 1} ${m.exercise_name || "Exercice"}`;
        if (s0.reps) t += ` × ${s0.reps}`;
        if (s0.load) t += ` @ ${s0.load}`;
        if (s0.rir != null && s0.rir !== "") t += ` RIR ${s0.rir}`;
        return t;
      })
      .join(" + ");
    out.push(`    Série ${L} · ${rounds} tour${rounds > 1 ? "s" : ""}${rest} : ${ex}`);
  }
  return out;
}

function fmtRest(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`;
}
