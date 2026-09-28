"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addEffortTestResultAction,
  createCustomEffortTestAction,
  deleteEffortTestBatchAction,
} from "@/lib/actions";
import { EFFORT_TEST_CATALOG, parseCustomFields, type EffortTestFieldDef } from "@/lib/effort-tests";
import { PERFORMANCE_METRICS, MEASUREMENT_DEVICES, groupMetrics, METRIC_LABELS } from "@/lib/performance-metrics";
import { sportIconPath } from "@/lib/sport-icons";
import { sportLabelPlain } from "@/lib/sport-labels";
import { todayISO } from "@/lib/dates";
import type { EffortTestBatch, CustomEffortTestRow } from "@/lib/queries";
import { Button } from "@/components/ui";

// Sports couverts par le référentiel de tests aujourd'hui (running/cycling/
// swimming) + les 3 autres sports de l'app, pour rester cohérent même sans
// test dédié pour l'instant — le coach retombe alors sur "Autre".
const SPORT_TILES = ["running", "cycling", "swimming", "hiking", "climbing", "strength"] as const;
const OTHER_SPORT = "__other__";

function SportIcon({ sport, size = 20 }: { sport: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={sportIconPath(sport)} />
    </svg>
  );
}

/** Regroupe les champs facultatifs d'un test par thème (cf. EffortTestFieldDef.group)
 * pour les afficher en sous-sections plutôt qu'en grille plate. */
function groupFields(fields: EffortTestFieldDef[]): { group: string; fields: EffortTestFieldDef[] }[] {
  const map = new Map<string, EffortTestFieldDef[]>();
  for (const f of fields) {
    const g = f.group ?? "Autres détails";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(f);
  }
  return Array.from(map.entries()).map(([group, fields]) => ({ group, fields }));
}

const inputClass = "rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss";
const fieldLabelClass = "font-medium text-ink-soft";

// Un test à l'effort n'est qu'une façon guidée de remplir des mesures déjà
// exploitées ailleurs (PMA/VMA, VO2max, FTP…) : le résultat calculé est
// répliqué dans athlete_measurements au moment de l'enregistrement, donc les
// zones d'allure/puissance/FC juste au-dessus se mettent à jour tout seules.
//
// Saisie en 2 temps — sport puis test — plutôt qu'un unique menu déroulant :
// un coach reconnaît le protocole qu'il a fait passer d'un coup d'œil (nom +
// description visibles avant de choisir) au lieu de devoir lire une longue
// liste triée par ordre alphabétique. Les champs très riches (ex. FTP 20 min,
// 11 champs) sont scindés entre l'essentiel (affiché tout de suite) et le
// détail facultatif (replié par thème), pour ne pas noyer la seule donnée
// vraiment nécessaire sous des champs qu'on n'a pas toujours sous la main.
export function EffortTestsPanel({
  athleteId,
  batches,
  customTests,
  defaultSport,
}: {
  athleteId: string;
  batches: EffortTestBatch[];
  customTests: CustomEffortTestRow[];
  defaultSport?: string;
}) {
  const router = useRouter();
  const [selectedSport, setSelectedSport] = useState<string | null>(
    defaultSport && (SPORT_TILES as readonly string[]).includes(defaultSport) ? defaultSport : null
  );
  const [selected, setSelected] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [customFieldCount, setCustomFieldCount] = useState(1);
  const [showHistory, setShowHistory] = useState(false);

  const builtin = selected.startsWith("builtin:") ? EFFORT_TEST_CATALOG[selected.slice(8)] : null;
  const custom = selected.startsWith("custom:") ? customTests.find((t) => t.id === selected.slice(7)) : null;
  const customFields = custom ? parseCustomFields(custom.fields_json) : [];
  // "Autre" : un test ponctuel que le référentiel ne connaît pas et que le
  // coach ne veut pas déclarer à l'avance (cf. "+ Créer un test personnalisé"
  // plus bas, pour un test qu'il refera régulièrement) — juste un nom, un
  // indicateur et une valeur, saisis une fois.
  const isOther = selected === "other";

  // Tests personnalisés dont le sport (texte libre du coach) ne correspond à
  // aucune des tuiles connues — rattachés à "Autre" pour ne jamais devenir
  // inaccessibles, même si le coach a tapé un intitulé inhabituel.
  const orphanCustomTests = customTests.filter(
    (t) => !(SPORT_TILES as readonly string[]).includes(t.sport.trim().toLowerCase())
  );

  function testsForSport(sport: string) {
    const builtinList = Object.values(EFFORT_TEST_CATALOG).filter((t) => t.sport === sport);
    const customList = customTests.filter((t) => t.sport.trim().toLowerCase() === sport);
    return [...builtinList, ...customList];
  }

  function selectSport(sport: string) {
    setSelected("");
    // Raccourci : "Autre" ne propose qu'une seule option la plupart du temps
    // (aucun test personnalisé "orphelin") — autant sauter directement à sa
    // saisie plutôt que d'afficher une liste à un seul élément.
    if (sport === OTHER_SPORT && orphanCustomTests.length === 0) {
      setSelectedSport(OTHER_SPORT);
      setSelected("other");
    } else {
      setSelectedSport(sport);
    }
  }

  const cards: { value: string; label: string; description?: string }[] =
    selectedSport === null
      ? []
      : selectedSport === OTHER_SPORT
        ? [
            ...orphanCustomTests.map((t) => ({ value: `custom:${t.id}`, label: t.name })),
            { value: "other", label: "Autre (test non répertorié)", description: "Un test fait une seule fois, sans le déclarer à l'avance." },
          ]
        : [
            ...testsForSport(selectedSport).map((t) =>
              "slug" in t
                ? { value: `builtin:${t.slug}`, label: t.label, description: t.description }
                : { value: `custom:${t.id}`, label: t.name }
            ),
            { value: "other", label: "Autre (test non répertorié)", description: "Un test fait une seule fois, sans le déclarer à l'avance." },
          ];

  const selectedCard = cards.find((c) => c.value === selected);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("athleteId", athleteId);
    if (builtin) formData.set("testSlug", builtin.slug);
    if (custom) formData.set("customTestId", custom.id);
    const result = await addEffortTestResultAction(formData);
    setPending(false);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    (e.target as HTMLFormElement).reset();
    // Revient à la liste de tests du même sport plutôt qu'à la case départ —
    // un coach enchaîne souvent plusieurs tests pour le même athlète.
    setSelected("");
    router.refresh();
  }

  async function handleCreateCustom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await createCustomEffortTestAction(formData);
    setPending(false);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    (e.target as HTMLFormElement).reset();
    setCustomFieldCount(1);
    setCreatingCustom(false);
    router.refresh();
  }

  async function handleDeleteBatch(batchId: string) {
    if (!confirm("Supprimer ce test et tous ses résultats ?")) return;
    setDeletingBatchId(batchId);
    await deleteEffortTestBatchAction(batchId, athleteId);
    router.refresh();
    setDeletingBatchId(null);
  }

  const visibleBatches = showHistory ? batches : batches.slice(0, 5);

  const requiredFields = builtin?.fields.filter((f) => !f.optional) ?? [];
  const optionalFields = builtin?.fields.filter((f) => f.optional) ?? [];
  const optionalGroupNames = Array.from(new Set(optionalFields.map((f) => f.group ?? "Autres détails")));

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <span className={`mb-1.5 block text-sm ${fieldLabelClass}`}>Quel sport ?</span>
          <div className="flex flex-wrap gap-2">
            {SPORT_TILES.map((sport) => (
              <button
                key={sport}
                type="button"
                onClick={() => selectSport(sport)}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-3 py-2 text-[11px] font-semibold transition-colors ${
                  selectedSport === sport ? "border-moss bg-moss/10 text-moss-dark" : "border-line text-ink-soft hover:border-moss/50"
                }`}
              >
                <SportIcon sport={sport} />
                {sportLabelPlain(sport)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => selectSport(OTHER_SPORT)}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-3 py-2 text-[11px] font-semibold transition-colors ${
                selectedSport === OTHER_SPORT ? "border-moss bg-moss/10 text-moss-dark" : "border-line text-ink-soft hover:border-moss/50"
              }`}
            >
              <SportIcon sport="other" />
              Autre
            </button>
          </div>
        </div>

        {selectedSport !== null && !selected && (
          <div className="animate-expand-in flex flex-col gap-1.5">
            <span className={`text-sm ${fieldLabelClass}`}>Quel test ?</span>
            {cards.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelected(c.value)}
                className="rounded-xl border border-line bg-white px-3 py-2 text-left hover:border-moss"
              >
                <p className="text-sm font-semibold text-ink">{c.label}</p>
                {c.description && <p className="text-xs text-slate">{c.description}</p>}
              </button>
            ))}
          </div>
        )}

        {selected && selectedCard && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-paper-dim px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{selectedCard.label}</p>
              {selectedCard.description && <p className="text-xs text-slate">{selectedCard.description}</p>}
            </div>
            <button type="button" onClick={() => setSelected("")} className="shrink-0 text-xs font-semibold text-moss-dark hover:underline">
              Changer
            </button>
          </div>
        )}

        {(builtin || custom || isOther) && (
          <div className="animate-expand-in grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={fieldLabelClass}>Date du test</span>
              <input type="date" name="testDate" defaultValue={todayISO()} required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={fieldLabelClass}>Matériel utilisé</span>
              <select name="device" className={inputClass}>
                {MEASUREMENT_DEVICES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            {isOther && (
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className={fieldLabelClass}>Type de test</span>
                <input
                  name="customLabel"
                  autoFocus
                  required
                  placeholder="ex. Test palier tapis, saut vertical…"
                  className={inputClass}
                />
              </label>
            )}

            {requiredFields.map((f, i) => (
              <label key={f.key} className="flex flex-col gap-1.5 text-sm">
                <span className={fieldLabelClass}>
                  {f.label} {f.unit ? `(${f.unit})` : ""}
                </span>
                <input type="number" step="any" name={`field_${f.key}`} required autoFocus={i === 0} className={inputClass} />
              </label>
            ))}

            {optionalFields.length > 0 && (
              <details className="sm:col-span-2 rounded-xl border border-line bg-paper-dim/50 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-moss-dark">
                  + Ajouter plus de détails ({optionalGroupNames.join(", ")})
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  {groupFields(optionalFields).map(({ group, fields }) => (
                    <div key={group}>
                      <p className="mb-1.5 text-sm font-semibold text-ink">{group}</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {fields.map((f) => (
                          <label key={f.key} className="flex flex-col gap-1.5 text-sm">
                            <span className={fieldLabelClass}>
                              {f.label} {f.unit ? `(${f.unit})` : ""}
                            </span>
                            <input type="number" step="any" name={`field_${f.key}`} className={inputClass} />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {customFields.map((f, i) => (
              <label key={f.key} className="flex flex-col gap-1.5 text-sm">
                <span className={fieldLabelClass}>
                  {f.label} {f.unit ? `(${f.unit})` : ""}
                </span>
                <input type="number" step="any" name={`field_${f.key}`} required={i === 0} autoFocus={i === 0} className={inputClass} />
              </label>
            ))}

            {(custom || isOther) && (
              <>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className={fieldLabelClass}>Indicateur obtenu</span>
                  <select name="resultMetric" required className={inputClass}>
                    {groupMetrics(PERFORMANCE_METRICS).map(({ group, items }) => (
                      <optgroup key={group} label={group}>
                        {items.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className={fieldLabelClass}>Valeur obtenue</span>
                  <input type="number" step="any" name="resultValue" required className={inputClass} />
                </label>
              </>
            )}

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className={fieldLabelClass}>Note (facultatif)</span>
              <input name="note" placeholder="Conditions, sensations…" className={inputClass} />
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className={fieldLabelClass}>Pièce jointe (facultatif)</span>
              <input
                type="file"
                name="attachment"
                accept="image/*,video/*,application/pdf"
                className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-paper-dim file:px-2 file:py-1 file:text-xs file:font-medium`}
              />
              <span className="text-xs text-slate">Photo de la feuille de test, capture d&apos;écran du tableur, vidéo, PDF…</span>
            </label>

            <div className="sm:col-span-2">
              <Button type="submit" loading={pending}>
                Enregistrer le résultat
              </Button>
            </div>
          </div>
        )}
      </form>

      {batches.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-sm font-semibold text-ink">Historique des tests</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {visibleBatches.map((b) => {
              const testLabel = b.testSlug
                ? EFFORT_TEST_CATALOG[b.testSlug]?.label ?? b.testSlug
                : b.customTestId
                  ? customTests.find((t) => t.id === b.customTestId)?.name ?? "Test personnalisé"
                  : b.customLabel ?? "Test personnalisé";
              const metricsText = b.metrics
                .map((m) => `${METRIC_LABELS[m.metric] ?? m.metric} = ${m.value}`)
                .join(" · ");
              return (
                <li key={b.batchId} className="flex items-start justify-between gap-2 rounded-xl bg-paper-dim p-2">
                  <span className="text-ink">
                    {b.testDate} — <b className="font-semibold">{testLabel}</b> : {metricsText}
                    {b.note && ` — ${b.note}`}
                    {b.attachmentPath && (
                      <>
                        {" "}
                        <a
                          href={`/api/effort-test-results/${b.ids[0]}/attachment`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-moss-dark hover:underline"
                        >
                          📎 pièce jointe
                        </a>
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteBatch(b.batchId)}
                    disabled={deletingBatchId === b.batchId}
                    aria-label="Supprimer ce test"
                    className="shrink-0 text-xs text-clay hover:underline disabled:opacity-40"
                  >
                    {deletingBatchId === b.batchId ? "…" : "Supprimer"}
                  </button>
                </li>
              );
            })}
          </ul>
          {batches.length > visibleBatches.length && (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="mt-2 text-xs font-semibold text-moss-dark hover:underline"
            >
              Voir les {batches.length - visibleBatches.length} tests plus anciens
            </button>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        {!creatingCustom ? (
          <button
            type="button"
            onClick={() => setCreatingCustom(true)}
            className="text-xs font-semibold text-moss-dark hover:underline"
          >
            + Créer un test personnalisé
          </button>
        ) : (
          <form onSubmit={handleCreateCustom} className="animate-expand-in flex flex-col gap-3 rounded-2xl bg-paper-dim p-3">
            <p className="text-xs text-slate">
              Pour un test que le référentiel ne connaît pas — définissez les données à relever selon votre matériel.
              Au moment d&apos;enregistrer un résultat, vous choisirez vous-même l&apos;indicateur de performance obtenu.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-ink-soft">Nom du test</span>
                <input
                  name="name"
                  autoFocus
                  placeholder="ex. Test palier tapis"
                  required
                  className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-ink-soft">Sport concerné</span>
                <input
                  name="sport"
                  placeholder="ex. running"
                  required
                  className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                />
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-ink-soft">Données à relever</span>
              {Array.from({ length: customFieldCount }).map((_, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <input
                    name="fieldLabel"
                    aria-label={`Nom du champ ${i + 1}`}
                    placeholder={`Champ ${i + 1} (ex. Vitesse palier 4)`}
                    required={i === 0}
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                  />
                  <input
                    name="fieldUnit"
                    aria-label={`Unité du champ ${i + 1}`}
                    placeholder="Unité (facultatif)"
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCustomFieldCount((n) => n + 1)}
                className="self-start text-xs font-semibold text-moss-dark hover:underline"
              >
                + Ajouter un champ
              </button>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" loading={pending}>
                Créer le test
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreatingCustom(false)} disabled={pending}>
                Annuler
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
