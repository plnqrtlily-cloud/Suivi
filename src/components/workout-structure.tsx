// Déroulé d'une séance d'endurance (intervals_json) en visuel : le profil de la
// séance d'un coup d'œil (largeur = durée, hauteur et couleur = intensité),
// puis chaque bloc avec ses étapes et ses répétitions, durées en gras et zones
// en pastilles. Sans dépendance serveur ni état : utilisable dans une page
// serveur comme dans un composant client.

const STEP_LABEL: Record<string, string> = {
  warmup: "Échauffement",
  work: "Effort",
  recovery: "Récupération",
  rest: "Repos",
  cooldown: "Retour au calme",
};
const STEP_COLOR: Record<string, string> = { warmup: "#9fc3c4", work: "#1b4b4f", recovery: "#c9dcdc", rest: "#e6eae9", cooldown: "#9fc3c4" };
// Même dégradé que l'éditeur de séance : Z1 clair → Z5 orangé.
const ZONE_COLOR = ["#dde3e2", "#c9dcdc", "#9fc3c4", "#5b8a8c", "#1b4b4f", "#e8896a"];
const ZONE_TEXT = ["#37413f", "#37413f", "#0f3336", "#ffffff", "#ffffff", "#ffffff"];
const TARGET_LABEL: Record<string, string> = { hr_zone: "FC", pace_zone: "Allure", power_zone: "Puissance" };
// Minutes par km pour estimer la place d'une étape en distance dans le profil.
const MIN_PER_KM: Record<string, number> = { running: 5.5, cycling: 2.2, swimming: 20, hiking: 12 };

interface Target {
  type?: string;
  zone?: number;
  freeText?: string;
}
interface Step {
  id?: string;
  kind?: string;
  stepType?: string;
  durationType?: string;
  durationValue?: string;
  stroke?: string;
  target?: Target;
}
interface Item extends Step {
  count?: number | string;
  steps?: Step[];
  items?: Item[];
  title?: string;
}

function isZone(t?: string) {
  return t === "hr_zone" || t === "pace_zone" || t === "power_zone";
}
function stepMinutes(s: Step, sport: string): number {
  if (s.durationType === "manual") return 5;
  if (s.durationType === "distance") {
    const km = Number(s.durationValue) / 1000;
    return Number.isNaN(km) ? 0 : km * (MIN_PER_KM[sport] ?? 5);
  }
  const m = String(s.durationValue ?? "").match(/^(\d+):(\d{1,2})$/);
  return m ? Number(m[1]) + Number(m[2]) / 60 : 0;
}
function fmtStep(s: Step): string {
  if (s.durationType === "manual") return "au ressenti";
  if (s.durationType === "distance") {
    const n = Number(s.durationValue);
    if (Number.isNaN(n)) return "—";
    return n >= 1000 ? `${String(Math.round(n / 10) / 100).replace(".", ",")} km` : `${n} m`;
  }
  const m = String(s.durationValue ?? "").match(/^(\d+):(\d{1,2})$/);
  if (!m) return "—";
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!min) return `${sec} s`;
  if (!sec) return `${min} min`;
  return `${min} min ${String(sec).padStart(2, "0")}`;
}
function fmtTotal(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`;
}

/** Remet les anciens formats (étapes et répétitions sans bloc) dans un bloc unique. */
function toBlocs(items: Item[]): Item[] {
  if (items.every((it) => it.kind === "bloc")) return items;
  const out: Item[] = [];
  let loose: Item | null = null;
  for (const it of items) {
    if (it.kind === "bloc") {
      loose = null;
      out.push(it);
    } else {
      if (!loose) {
        loose = { kind: "bloc", title: "", items: [] };
        out.push(loose);
      }
      loose.items!.push(it);
    }
  }
  return out;
}
function flatten(items: Item[]): Step[] {
  const out: Step[] = [];
  for (const it of items) {
    if (it.kind === "bloc") out.push(...flatten(it.items ?? []));
    else if (it.kind === "repeat") for (let i = 0; i < Math.min(Number(it.count) || 1, 40); i++) out.push(...(it.steps ?? []));
    else out.push(it);
  }
  return out;
}

export function parseStructure(json: string | null | undefined): Item[] | null {
  if (!json) return null;
  try {
    const items = JSON.parse(json);
    return Array.isArray(items) && items.length ? (items as Item[]) : null;
  } catch {
    return null;
  }
}

function TargetChip({ t }: { t?: Target }) {
  if (!t || !t.type || t.type === "none") return null;
  if (t.type === "free") {
    if (!t.freeText) return null;
    return <span className="rounded-full bg-paper-dim px-2.5 py-0.5 text-xs font-semibold text-ink-soft">{t.freeText}</span>;
  }
  if (!isZone(t.type) || !t.zone) return null;
  return (
    <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: ZONE_COLOR[t.zone] ?? "#e6eae9", color: ZONE_TEXT[t.zone] ?? "#182220" }}>
      {TARGET_LABEL[t.type]} Z{t.zone}
    </span>
  );
}

function StepLine({ s }: { s: Step }) {
  const type = s.stepType ?? "work";
  const z = isZone(s.target?.type) ? s.target?.zone ?? 0 : 0;
  return (
    <div className="flex items-center gap-2.5 py-1.5 sm:gap-3">
      <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: z ? ZONE_COLOR[z] : STEP_COLOR[type] ?? "#9aa39c" }} />
      <span className="w-[84px] shrink-0 text-[12.5px] leading-tight text-slate sm:w-[112px] sm:text-[13px]">{STEP_LABEL[type] ?? type}</span>
      <b className="min-w-[64px] whitespace-nowrap text-[15px] text-ink">{fmtStep(s)}</b>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <TargetChip t={s.target} />
        {s.stroke && <span className="text-[13px] text-ink-soft">{String(s.stroke).toLowerCase()}</span>}
      </span>
    </div>
  );
}

export function WorkoutStructure({ json, sport = "running" }: { json: string | null | undefined; sport?: string }) {
  const items = parseStructure(json);
  if (!items) return null;
  const blocs = toBlocs(items);
  const flat = flatten(items);
  let total = 0;
  let hard = 0;
  let meters = 0;
  for (const s of flat) {
    const m = stepMinutes(s, sport);
    total += m;
    if (s.durationType === "distance") meters += Number(s.durationValue) || 0;
    if (isZone(s.target?.type) && (s.target?.zone ?? 0) >= 3 && s.stepType !== "recovery" && s.stepType !== "rest") hard += m;
  }
  const bars = flat.map((s) => {
    const z = isZone(s.target?.type) ? s.target?.zone ?? 0 : 0;
    const h = z ? 16 + z * 12 : s.stepType === "work" ? 52 : s.stepType === "warmup" || s.stepType === "cooldown" ? 28 : 18;
    return { w: Math.max(stepMinutes(s, sport), 0.4), h, c: z ? ZONE_COLOR[z] : STEP_COLOR[s.stepType ?? "work"] ?? "#9aa39c" };
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Profil de la séance */}
      <div className="rounded-2xl bg-[#f5f7f6] px-4 pb-3 pt-4">
        <div className="flex h-[76px] items-end gap-[2px]" aria-hidden="true">
          {bars.map((b, i) => (
            <span key={i} className="rounded-t-[4px]" style={{ flexGrow: b.w, flexBasis: 0, height: b.h, background: b.c, minWidth: 3 }} />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate">
          <span>
            <b className="text-[15px] text-ink">≈ {fmtTotal(total)}</b> au total
          </span>
          {meters > 0 && (
            <span>
              <b className="text-[15px] text-ink">{String(Math.round(meters / 100) / 10).replace(".", ",")} km</b> en distance
            </span>
          )}
          {hard > 0 && (
            <span>
              <b className="text-[15px] text-ink">{fmtTotal(hard)}</b> en zone 3 et plus
            </span>
          )}
        </div>
      </div>

      {/* Blocs */}
      {blocs.map((bloc, bi) => {
        const inside = bloc.items ?? [];
        const blocMin = flatten(inside).reduce((t, s) => t + stepMinutes(s, sport), 0);
        return (
          <section key={bloc.id ?? bi} className="flex flex-col">
            {bloc.title ? (
              <div className="mb-1 flex items-baseline gap-2 border-b border-paper-dim pb-1.5">
                <h4 className="text-[15px] font-bold text-ink">{bloc.title}</h4>
                <span className="flex-1" />
                <span className="text-[13px] text-slate">{fmtTotal(blocMin)}</span>
              </div>
            ) : null}
            {inside.map((it, ii) =>
              it.kind === "repeat" ? (
                <div key={it.id ?? ii} className="my-1.5 rounded-2xl border border-[#d7e3e2] bg-[#f7faf9] px-3 pb-1.5 pt-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded-full bg-moss px-2.5 py-0.5 text-[13px] font-bold text-white">{Number(it.count) || 1} ×</span>
                    <span className="text-[13px] text-slate">
                      à répéter · {fmtTotal(flatten([it]).reduce((t, s) => t + stepMinutes(s, sport), 0))} au total
                    </span>
                  </div>
                  <div className="mt-1 flex flex-col">
                    {(it.steps ?? []).map((s, si) => (
                      <StepLine key={s.id ?? si} s={s} />
                    ))}
                  </div>
                </div>
              ) : (
                <StepLine key={it.id ?? ii} s={it} />
              )
            )}
          </section>
        );
      })}
    </div>
  );
}
