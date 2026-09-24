"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addEffortTestResultAction,
  createCustomEffortTestAction,
  deleteEffortTestResultAction,
} from "@/lib/actions";
import { EFFORT_TEST_CATALOG, parseCustomFields } from "@/lib/effort-tests";
import { PERFORMANCE_METRICS, MEASUREMENT_DEVICES, groupMetrics, METRIC_LABELS } from "@/lib/performance-metrics";
import { todayISO } from "@/lib/dates";
import type { EffortTestResultRow, CustomEffortTestRow } from "@/lib/queries";
import { Button } from "@/components/ui";

const BUILTIN_TESTS = Object.values(EFFORT_TEST_CATALOG);

// Un test à l'effort n'est qu'une façon guidée de remplir des mesures déjà
// exploitées ailleurs (PMA/VMA, VO2max, FTP…) : le résultat calculé est
// répliqué dans athlete_measurements au moment de l'enregistrement, donc les
// zones d'allure/puissance/FC juste au-dessus se mettent à jour tout seules.
export function EffortTestsPanel({
  athleteId,
  results,
  customTests,
}: {
  athleteId: string;
  results: EffortTestResultRow[];
  customTests: CustomEffortTestRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [customFieldCount, setCustomFieldCount] = useState(1);
  const [showHistory, setShowHistory] = useState(false);

  const builtin = selected.startsWith("builtin:") ? EFFORT_TEST_CATALOG[selected.slice(8)] : null;
  const custom = selected.startsWith("custom:") ? customTests.find((t) => t.id === selected.slice(7)) : null;
  const customFields = custom ? parseCustomFields(custom.fields_json) : [];

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

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce résultat de test ?")) return;
    setDeletingId(id);
    await deleteEffortTestResultAction(id, athleteId);
    router.refresh();
    setDeletingId(null);
  }

  const visibleResults = showHistory ? results : results.slice(0, 5);

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-soft">Test réalisé</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            required
            className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
          >
            <option value="" disabled>
              Choisir un test…
            </option>
            <optgroup label="Tests connus">
              {BUILTIN_TESTS.map((t) => (
                <option key={t.slug} value={`builtin:${t.slug}`}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            {customTests.length > 0 && (
              <optgroup label="Mes tests personnalisés">
                {customTests.map((t) => (
                  <option key={t.id} value={`custom:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {builtin && <p className="text-xs text-slate">{builtin.description}</p>}

        {(builtin || custom) && (
          <div className="animate-expand-in grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-soft">Date du test</span>
              <input
                type="date"
                name="testDate"
                defaultValue={todayISO()}
                required
                className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-soft">Matériel utilisé</span>
              <select name="device" className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss">
                {MEASUREMENT_DEVICES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            {builtin?.fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-soft">
                  {f.label} {f.unit ? `(${f.unit})` : ""} {f.optional ? "— facultatif" : ""}
                </span>
                <input
                  type="number"
                  step="any"
                  name={`field_${f.key}`}
                  required={!f.optional}
                  className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                />
              </label>
            ))}

            {customFields.map((f, i) => (
              <label key={f.key} className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-soft">
                  {f.label} {f.unit ? `(${f.unit})` : ""}
                </span>
                <input
                  type="number"
                  step="any"
                  name={`field_${f.key}`}
                  required={i === 0}
                  className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                />
              </label>
            ))}

            {custom && (
              <>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-ink-soft">Indicateur obtenu</span>
                  <select
                    name="resultMetric"
                    required
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                  >
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
                  <span className="font-medium text-ink-soft">Valeur obtenue</span>
                  <input
                    type="number"
                    step="any"
                    name="resultValue"
                    required
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                  />
                </label>
              </>
            )}

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-ink-soft">Note (facultatif)</span>
              <input
                name="note"
                placeholder="Conditions, sensations…"
                className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
              />
            </label>

            <div className="sm:col-span-2">
              <Button type="submit" loading={pending}>
                Enregistrer le résultat
              </Button>
            </div>
          </div>
        )}
      </form>

      {results.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate">Historique des tests</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {visibleResults.map((r) => {
              const testLabel = r.test_slug
                ? EFFORT_TEST_CATALOG[r.test_slug]?.label ?? r.test_slug
                : customTests.find((t) => t.id === r.custom_test_id)?.name ?? "Test personnalisé";
              const metricLabel = METRIC_LABELS[r.result_metric] ?? r.result_metric;
              return (
                <li key={r.id} className="flex items-start justify-between gap-2 rounded-xl bg-paper-dim p-2">
                  <span className="text-ink">
                    {r.test_date} — <b className="font-semibold">{testLabel}</b> : {metricLabel} = {r.result_value}
                    {r.note && ` — ${r.note}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    aria-label="Supprimer ce résultat"
                    className="shrink-0 text-xs text-clay hover:underline disabled:opacity-40"
                  >
                    {deletingId === r.id ? "…" : "Supprimer"}
                  </button>
                </li>
              );
            })}
          </ul>
          {results.length > visibleResults.length && (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="mt-2 text-xs font-semibold text-moss-dark hover:underline"
            >
              Voir les {results.length - visibleResults.length} résultats plus anciens
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
