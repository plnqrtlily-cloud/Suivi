"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addEffortTestResultAction,
  createCustomEffortTestAction,
  deleteEffortTestBatchAction,
} from "@/lib/actions";
import { EFFORT_TEST_CATALOG, ERGOMETERS, DEFAULT_PROTOCOLS, parseCustomFields, type EffortTestFieldDef } from "@/lib/effort-tests";
import { PERFORMANCE_METRICS, groupMetrics, METRIC_LABELS } from "@/lib/performance-metrics";
import { todayISO } from "@/lib/dates";
import type { EffortTestBatch, CustomEffortTestRow } from "@/lib/queries";
import { Button } from "@/components/ui";

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
  editBatch,
  onDone,
}: {
  athleteId: string;
  batches: EffortTestBatch[];
  customTests: CustomEffortTestRow[];
  defaultSport?: string;
  /** Test à modifier : le formulaire s'ouvre pré-rempli et remplace ce test. */
  editBatch?: EffortTestBatch | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const initialKey = editBatch
    ? editBatch.testSlug
      ? `builtin:${editBatch.testSlug}`
      : editBatch.customTestId
        ? `custom:${editBatch.customTestId}`
        : "other"
    : "";
  const [ergo, setErgo] = useState<string>(editBatch?.device || (editBatch ? "autre" : ""));
  const [selected, setSelected] = useState<string>(initialKey);
  const [name, setName] = useState(editBatch?.customLabel ?? "");
  const [protocol, setProtocol] = useState(
    editBatch ? editBatch.protocol ?? (editBatch.testSlug ? DEFAULT_PROTOCOLS[editBatch.testSlug] ?? "" : "") : ""
  );
  const [extras, setExtras] = useState<{ label: string; value: string; unit: string }[]>(
    (editBatch?.extras ?? []).map((e) => ({ label: e.label, value: e.value, unit: e.unit ?? "" }))
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [customFieldCount, setCustomFieldCount] = useState(1);
  const [showHistory, setShowHistory] = useState(false);

  const builtin = selected.startsWith("builtin:") ? EFFORT_TEST_CATALOG[selected.slice(8)] : null;
  const custom = selected.startsWith("custom:") ? customTests.find((t) => t.id === selected.slice(7)) : null;
  const customFields = custom ? parseCustomFields(custom.fields_json) : [];
  const isOther = selected === "other";

  // Tests nommés déjà passés (« Autre test ») : proposés à nouveau pour être comparés.
  const namedTests = Array.from(
    new Map(
      batches.filter((b) => b.customLabel && !b.testSlug && !b.customTestId).map((b) => [b.customLabel!.toLowerCase(), b])
    ).values()
  );
  const legacyErgo: Record<string, string[]> = { cycling: ["ergocycle", "terrain"], running: ["piste", "tapis"], swimming: ["piscine"] };
  const ergoDef = ERGOMETERS.find((e) => e.value === ergo);
  const testOptions: { value: string; label: string }[] = ergo
    ? [
        ...(ergoDef?.tests ?? []).map((slug) => ({ value: `builtin:${slug}`, label: EFFORT_TEST_CATALOG[slug]?.label ?? slug })),
        ...customTests
          .filter((t) => {
            const sp = t.sport.trim().toLowerCase();
            return sp === ergo || (legacyErgo[sp] ?? []).includes(ergo) || (ergo === "autre" && !legacyErgo[sp] && !ERGOMETERS.some((e) => e.value === sp));
          })
          .map((t) => ({ value: `custom:${t.id}`, label: `Mes tests · ${t.name}` })),
        ...namedTests.filter((b) => !b.device || b.device === ergo || ergo === "autre").map((b) => ({ value: `named:${b.batchId}`, label: `Mes tests · ${b.customLabel}` })),
        { value: "other", label: "Autre test… (à nommer)" },
      ]
    : [];

  function pickTest(v: string) {
    setError("");
    if (v.startsWith("named:")) {
      const b = batches.find((x) => x.batchId === v.slice(6));
      setSelected("other");
      setName(b?.customLabel ?? "");
      setProtocol(b?.protocol ?? "");
      setExtras((b?.extras ?? []).map((e) => ({ label: e.label, value: "", unit: e.unit ?? "" })));
      return;
    }
    setSelected(v);
    setName("");
    setProtocol(v.startsWith("builtin:") ? DEFAULT_PROTOCOLS[v.slice(8)] ?? "" : "");
    setExtras(v === "other" ? [{ label: "", value: "", unit: "" }] : []);
  }
  const previousNamed = isOther && name.trim() ? namedTests.find((b) => b.customLabel!.trim().toLowerCase() === name.trim().toLowerCase() && b.batchId !== editBatch?.batchId) : undefined;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("athleteId", athleteId);
    formData.set("device", ergo === "autre" ? "" : ergo);
    formData.set("protocol", protocol);
    formData.set("extras", JSON.stringify(extras.filter((x) => x.label.trim() && x.value.trim())));
    if (builtin) formData.set("testSlug", builtin.slug);
    if (custom) formData.set("customTestId", custom.id);
    if (isOther) formData.set("customLabel", name);
    if (editBatch) formData.set("replaceBatchId", editBatch.batchId);
    const result = await addEffortTestResultAction(formData);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    (e.target as HTMLFormElement).reset();
    setSelected("");
    setExtras([]);
    onDone?.();
    router.refresh();
  }

  async function handleCreateCustom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await createCustomEffortTestAction(formData);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
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
  const val = (k: string) => (editBatch && editBatch.data[k] !== undefined ? String(editBatch.data[k]) : undefined);

  const requiredFields = builtin?.fields.filter((f) => !f.optional) ?? [];
  const optionalFields = builtin?.fields.filter((f) => f.optional) ?? [];
  const optionalGroupNames = Array.from(new Set(optionalFields.map((f) => f.group ?? "Autres détails")));
  const hasTest = !!(builtin || custom || isOther);

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className={fieldLabelClass}>Ergomètre</span>
            <select
              value={ergo}
              onChange={(e) => {
                setErgo(e.target.value);
                setSelected("");
              }}
              className={inputClass}
            >
              <option value="">Choisir l’ergomètre…</option>
              {ERGOMETERS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className={fieldLabelClass}>Test</span>
            <select value={selected} onChange={(e) => pickTest(e.target.value)} disabled={!ergo} className={`${inputClass} disabled:opacity-50`}>
              <option value="">{ergo ? "Choisir le test…" : "—"}</option>
              {testOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {builtin?.description && <p className="-mt-1 text-xs text-slate">{builtin.description}</p>}

        {hasTest && (
          <div key={selected} className="animate-expand-in grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-2">
            {isOther && (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className={fieldLabelClass}>Nom du test</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="ex. Test Conconi, 1000 m SkiErg…" className={inputClass} />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={fieldLabelClass}>Date du test</span>
              <input type="date" name="testDate" defaultValue={editBatch?.testDate.slice(0, 10) ?? todayISO()} required className={inputClass} />
            </label>
            {previousNamed && (
              <p className="text-xs text-ink-soft sm:col-span-2">
                Comparé à « {previousNamed.customLabel} » du {previousNamed.testDate.slice(0, 10)} :{" "}
                {previousNamed.extras.map((x) => `${x.label} ${x.value}${x.unit ? ` ${x.unit}` : ""}`).join(" · ")}
              </p>
            )}

            {requiredFields.map((f, i) => (
              <label key={f.key} className="flex flex-col gap-1.5 text-sm">
                <span className={fieldLabelClass}>
                  {f.label} {f.unit ? `(${f.unit})` : ""} *
                </span>
                <input type="number" step="any" name={`field_${f.key}`} defaultValue={val(f.key)} required autoFocus={i === 0 && !editBatch} className={inputClass} />
              </label>
            ))}

            {optionalFields.length > 0 && (
              <details open={!!editBatch} className="sm:col-span-2 rounded-xl border border-line bg-paper-dim/50 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-moss-dark">+ Plus de données ({optionalGroupNames.join(", ")})</summary>
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
                            <input type="number" step="any" name={`field_${f.key}`} defaultValue={val(f.key)} className={inputClass} />
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
                <input type="number" step="any" name={`field_${f.key}`} defaultValue={val(f.key)} required={i === 0} className={inputClass} />
              </label>
            ))}

            {custom && (
              <>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className={fieldLabelClass}>Indicateur obtenu</span>
                  <select name="resultMetric" required defaultValue={editBatch?.metrics[0]?.metric} className={inputClass}>
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
                  <input type="number" step="any" name="resultValue" required defaultValue={editBatch?.metrics[0]?.value} className={inputClass} />
                </label>
              </>
            )}

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className={fieldLabelClass}>Protocole</span>
              <textarea value={protocol} onChange={(e) => setProtocol(e.target.value)} rows={2} placeholder="Déroulé du test, matériel, conditions…" className={`${inputClass} resize-y`} />
            </label>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className={`text-sm ${fieldLabelClass}`}>{isOther ? "Données du test" : "Résultats complémentaires"}</span>
              {extras.map((x, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_90px_30px] items-center gap-2">
                  <input value={x.label} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} placeholder="Nom (ex. Lactate à 300 W)" className={inputClass} />
                  <input value={x.value} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} placeholder="Valeur" className={inputClass} />
                  <input value={x.unit} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, unit: e.target.value } : y)))} placeholder="Unité" className={inputClass} />
                  <button type="button" aria-label="Retirer" onClick={() => setExtras(extras.filter((_, j) => j !== i))} className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-slate">
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setExtras([...extras, { label: "", value: "", unit: "" }])} className="self-start rounded-full border border-dashed border-line px-3 py-1.5 text-xs font-semibold text-moss-dark">
                + Ajouter {isOther ? "une donnée" : "un résultat"}
              </button>
            </div>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className={fieldLabelClass}>Note (facultatif)</span>
              <input name="note" defaultValue={editBatch?.note ?? ""} placeholder="Conditions, sensations…" className={inputClass} />
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className={fieldLabelClass}>Pièce jointe (facultatif)</span>
              <input
                type="file"
                name="attachment"
                accept="image/*,video/*,application/pdf"
                className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-paper-dim file:px-2 file:py-1 file:text-xs file:font-medium`}
              />
              <span className="text-xs text-slate">
                {editBatch?.attachmentName ? `Pièce jointe actuelle : ${editBatch.attachmentName} (conservée si vous n’en choisissez pas d’autre)` : "Photo de la feuille de test, capture d'écran, vidéo, PDF…"}
              </span>
            </label>

            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" loading={pending}>
                {editBatch ? "Enregistrer les modifications" : "Enregistrer le test"}
              </Button>
              {onDone && (
                <button type="button" onClick={onDone} className="text-sm font-semibold text-slate hover:text-ink">
                  Annuler
                </button>
              )}
              {error && <span className="text-sm text-clay">{error}</span>}
            </div>
          </div>
        )}
      </form>

      {editBatch ? null : (
      <>
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
      </>
      )}
    </div>
  );
}
