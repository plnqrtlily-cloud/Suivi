import { Card } from "@/components/ui";
import type { TrainingPeriod } from "@/lib/queries";
import {
  PERIOD_LEVELS,
  FOCUS_PRESETS,
  LOAD_PATTERNS,
  BLOCK_TEMPLATES,
  templateWeeks,
  focusLabel,
  periodColor,
  periodWeeks,
  periodDays,
  deloadWeeks,
  weekPosition,
  type LoadPattern,
} from "@/lib/periodization";
import {
  createTrainingPeriodAction,
  createPeriodFromTemplateAction,
  updateTrainingPeriodAction,
  deleteTrainingPeriodAction,
} from "@/lib/actions";

const LEVEL_LABEL: Record<string, string> = { saison: "Saison", bloc: "Bloc", cycle: "Cycle" };
const VOLUMES = ["faible", "modéré", "élevé"];
const INTENSITIES = ["faible", "modérée", "élevée", "maximale"];

function fr(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
}

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-moss focus:outline-none";
const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate";

/**
 * Frise chronologique : chaque période devient une barre positionnée sur la
 * durée totale couverte. C'est la lecture qu'un coach attend d'une
 * planification — voir d'un coup si les blocs s'enchaînent sans trou et où
 * tombe l'échéance, ce qu'une simple liste de dates ne montre pas.
 */
function Timeline({ periods, today }: { periods: TrainingPeriod[]; today: string }) {
  if (periods.length === 0) return null;

  const from = periods.reduce((min, p) => (p.start_date < min ? p.start_date : min), periods[0].start_date);
  const to = periods.reduce((max, p) => (p.end_date > max ? p.end_date : max), periods[0].end_date);
  const total = periodDays(from, to);
  const pct = (dateISO: string) => ((periodDays(from, dateISO) - 1) / total) * 100;

  const byLevel = (["saison", "bloc", "cycle"] as const)
    .map((level) => ({ level, items: periods.filter((p) => p.level === level) }))
    .filter((g) => g.items.length > 0);

  const todayPct = today >= from && today <= to ? pct(today) : null;

  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-line bg-white p-3">
      <div className="mb-2 flex justify-between text-[11px] text-slate">
        <span>{fr(from)}</span>
        <span>{fr(to)}</span>
      </div>
      <div className="relative flex flex-col gap-1.5">
        {todayPct !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-gold-light"
            style={{ left: `${todayPct}%` }}
          />
        )}
        {byLevel.map((group) => (
          <div key={group.level} className="relative h-7">
            {group.items.map((p) => {
              const left = pct(p.start_date);
              const width = Math.max(1.5, (periodDays(p.start_date, p.end_date) / total) * 100);
              return (
                <span
                  key={p.id}
                  title={`${LEVEL_LABEL[p.level]} · ${p.name} — ${fr(p.start_date)} au ${fr(p.end_date)}`}
                  className="absolute top-0 flex h-7 items-center overflow-hidden rounded-md px-2 text-[11px] font-semibold text-white"
                  style={{
                    left: `${left}%`,
                    width: `${Math.min(width, 100 - left)}%`,
                    backgroundColor: periodColor(p.focus, p.color),
                  }}
                >
                  <span className="truncate">{p.name}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rangée de pastilles : une par semaine, celles de décharge en creux. */
function WeekStrip({ period }: { period: TrainingPeriod }) {
  const weeks = periodWeeks(period.start_date, period.end_date);
  if (weeks < 2) return null;
  const deloads = deloadWeeks((period.load_pattern as LoadPattern) || "plat", weeks);
  const color = periodColor(period.focus, period.color);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
        const isDeload = deloads.includes(w);
        return (
          <span
            key={w}
            title={isDeload ? `Semaine ${w} — décharge` : `Semaine ${w} — charge`}
            className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold"
            style={
              isDeload
                ? { color, boxShadow: `inset 0 0 0 1.5px ${color}` }
                : { backgroundColor: color, color: "#fff" }
            }
          >
            {w}
          </span>
        );
      })}
      {deloads.length > 0 && <span className="ml-1 text-[11px] text-slate">creux = semaine de décharge</span>}
    </div>
  );
}

function PeriodFields({ period }: { period?: TrainingPeriod }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Niveau</label>
          <select name="level" defaultValue={period?.level ?? "cycle"} className={inputClass}>
            {PERIOD_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label} — {l.hint}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Orientation</label>
          <select name="focus" defaultValue={period?.focus ?? ""} className={inputClass}>
            <option value="">Sans orientation</option>
            {FOCUS_PRESETS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label} (~{f.typicalWeeks} sem., volume {f.volume}, intensité {f.intensity})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Nom</label>
        <input
          name="name"
          defaultValue={period?.name ?? ""}
          placeholder="Laissé vide : le nom de l'orientation"
          className={inputClass}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Début</label>
          <input type="date" name="startDate" defaultValue={period?.start_date ?? ""} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Fin</label>
          <input type="date" name="endDate" defaultValue={period?.end_date ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>ou durée (sem.)</label>
          <input type="number" name="weeks" min={1} max={104} placeholder="4" className={inputClass} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Schéma de charge</label>
          <select name="loadPattern" defaultValue={period?.load_pattern ?? "3:1"} className={inputClass}>
            {LOAD_PATTERNS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} — {p.hint}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Volume</label>
          <select name="volume" defaultValue={period?.volume ?? ""} className={inputClass}>
            <option value="">—</option>
            {VOLUMES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Intensité</label>
          <select name="intensity" defaultValue={period?.intensity ?? ""} className={inputClass}>
            <option value="">—</option>
            {INTENSITIES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Objectif de la période</label>
        <input
          name="objective"
          defaultValue={period?.objective ?? ""}
          placeholder="Ex. porter le volume à 8 h/sem. sans perte de qualité"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea name="notes" defaultValue={period?.notes ?? ""} rows={2} className={inputClass} />
      </div>
    </>
  );
}

export function PeriodizationPanel({
  athleteId,
  periods,
  today,
}: {
  athleteId: string;
  periods: TrainingPeriod[];
  today: string;
}) {
  const current = periods.filter((p) => p.start_date <= today && today <= p.end_date);
  const upcoming = periods.filter((p) => p.start_date > today);
  const past = periods.filter((p) => p.end_date < today);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="mb-1 font-display text-xl text-ink">Périodisation</h2>
        <p className="text-sm text-slate">
          Découpez la saison en périodes emboîtées — saison, blocs, cycles — pour donner une direction à la
          programmation au lieu d&apos;empiler des séances.
        </p>
      </div>

      {current.length > 0 && (
        <Card className="rounded-3xl">
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate">En cours aujourd&apos;hui</h3>
          <div className="flex flex-col gap-3">
            {current.map((p) => {
              const pos = weekPosition(p, today);
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                    style={{ backgroundColor: periodColor(p.focus, p.color) }}
                  >
                    {LEVEL_LABEL[p.level]}
                  </span>
                  <span className="font-medium text-ink">{p.name}</span>
                  <span className="text-slate">{focusLabel(p.focus)}</span>
                  {pos && (
                    <span className={`text-xs ${pos.isDeload ? "font-semibold text-gold-light" : "text-slate"}`}>
                      semaine {pos.week}/{pos.totalWeeks}
                      {pos.isDeload ? " · décharge" : ""}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate">jusqu&apos;au {fr(p.end_date)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Timeline periods={periods} today={today} />

      {/* Créer un bloc complet depuis un modèle : le raccourci qui évite de
          saisir chaque cycle à la main. */}
      <Card className="rounded-3xl">
        <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate">Construire un bloc complet</h3>
        <p className="mb-3 text-xs text-slate">
          Le modèle crée le bloc et ses cycles enchaînés, avec volumes et intensités indicatifs. Tout reste modifiable
          ensuite.
        </p>
        <form action={createPeriodFromTemplateAction} className="flex flex-col gap-3">
          <input type="hidden" name="athleteId" value={athleteId} />
          <div>
            <label className={labelClass}>Modèle</label>
            <select name="template" className={inputClass} defaultValue={BLOCK_TEMPLATES[0].value}>
              {BLOCK_TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} — {templateWeeks(t)} semaines
                </option>
              ))}
            </select>
          </div>
          <ul className="flex flex-col gap-1 text-xs text-slate">
            {BLOCK_TEMPLATES.map((t) => (
              <li key={t.value}>
                <span className="font-semibold text-ink-soft">{t.label}</span> — {t.description}
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Début du bloc</label>
              <input type="date" name="startDate" defaultValue={today} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nom du bloc</label>
              <input name="name" placeholder="Ex. Bloc hivernal" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Objectif du bloc</label>
            <input name="objective" placeholder="Ex. être prêt pour le 10 km de mars" className={inputClass} />
          </div>
          <button type="submit" className="self-start rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white">
            Créer le bloc et ses cycles
          </button>
        </form>
      </Card>

      <Card className="rounded-3xl">
        <details>
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-slate">
            Ajouter une période seule
          </summary>
          <form action={createTrainingPeriodAction} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="athleteId" value={athleteId} />
            <PeriodFields />
            <button type="submit" className="self-start rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white">
              Ajouter la période
            </button>
          </form>
        </details>
      </Card>

      {[
        { title: "En cours et à venir", items: [...current, ...upcoming] },
        { title: "Périodes passées", items: past },
      ]
        .filter((g) => g.items.length > 0)
        .map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate">{group.title}</h3>
            <div className="flex flex-col gap-2">
              {group.items.map((p) => (
                <Card key={p.id} className="rounded-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded"
                      style={{ backgroundColor: periodColor(p.focus, p.color) }}
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate">
                      {LEVEL_LABEL[p.level]}
                    </span>
                    <span className="font-medium text-ink">{p.name}</span>
                    <span className="text-xs text-slate">
                      {fr(p.start_date)} → {fr(p.end_date)} · {periodWeeks(p.start_date, p.end_date)} sem.
                    </span>
                    {p.volume && <span className="text-xs text-slate">volume {p.volume}</span>}
                    {p.intensity && <span className="text-xs text-slate">intensité {p.intensity}</span>}
                  </div>

                  {p.objective && <p className="mt-2 text-sm text-ink-soft">{p.objective}</p>}
                  {p.notes && <p className="mt-1 text-xs text-slate">{p.notes}</p>}

                  <div className="mt-2">
                    <WeekStrip period={p} />
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate">Modifier</summary>
                    <form action={updateTrainingPeriodAction} className="mt-3 flex flex-col gap-3">
                      <input type="hidden" name="periodId" value={p.id} />
                      <PeriodFields period={p} />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-white"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </form>
                    <form action={deleteTrainingPeriodAction} className="mt-2">
                      <input type="hidden" name="periodId" value={p.id} />
                      <button type="submit" className="text-xs font-semibold text-clay hover:underline">
                        Supprimer cette période
                      </button>
                    </form>
                  </details>
                </Card>
              ))}
            </div>
          </div>
        ))}

      {periods.length === 0 && (
        <Card className="rounded-3xl">
          <p className="text-sm text-slate">
            Aucune période pour l&apos;instant. Commencez par un bloc depuis un modèle, puis ajustez ses cycles.
          </p>
        </Card>
      )}
    </div>
  );
}
