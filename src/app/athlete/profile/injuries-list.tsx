"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateInjuryAction, deleteInjuryAction } from "@/lib/actions";
import type { Injury } from "@/lib/queries";

// Historique éditable des antécédents : jusqu'ici seul l'ajout était possible,
// une erreur de saisie (mauvaise zone, mauvaise date) restait donc définitive.
export function InjuriesList({ injuries }: { injuries: Injury[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Copie locale retirée optimistiquement à la suppression : attendre le
  // router.refresh() pour faire disparaître la ligne donnait l'impression
  // que le clic n'avait rien fait pendant l'aller-retour serveur.
  const [items, setItems] = useState(injuries);
  useEffect(() => setItems(injuries), [injuries]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    await updateInjuryAction(id, formData);
    setPending(false);
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet antécédent ?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    await deleteInjuryAction(id);
    router.refresh();
  }

  if (items.length === 0) {
    return <p className="text-slate">Aucun antécédent renseigné.</p>;
  }

  return (
    <ul className="mb-4 space-y-2 text-sm">
      {items.map((i) => {
        if (editingId === i.id) {
          return (
            <li key={i.id} className="rounded-xl border border-line bg-white p-3">
              <form onSubmit={(e) => handleSave(e, i.id)} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-ink-soft">Zone</span>
                  <input
                    name="zone"
                    defaultValue={i.zone}
                    required
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-ink-soft">Description</span>
                  <input
                    name="description"
                    defaultValue={i.description || ""}
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-ink-soft">Date de début</span>
                  <input
                    type="date"
                    name="dateStart"
                    defaultValue={i.date_start}
                    required
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-ink-soft">Date de fin (si guéri)</span>
                  <input
                    type="date"
                    name="dateEnd"
                    defaultValue={i.date_end || ""}
                    className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-moss"
                  />
                </label>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-md bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-moss-dark disabled:opacity-50"
                  >
                    {pending ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    disabled={pending}
                    className="text-sm text-ink-soft hover:text-ink"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </li>
          );
        }
        return (
          <li key={i.id} className="flex items-start justify-between gap-2 rounded-xl bg-paper-dim p-2">
            <span>
              <span className="font-medium text-ink">{i.zone}</span> — {i.description}{" "}
              <span className="text-slate">
                ({i.date_start}
                {i.date_end ? ` → ${i.date_end}` : ""})
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEditingId(i.id)}
                className="font-medium text-moss-dark hover:underline"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={() => handleDelete(i.id)}
                aria-label="Supprimer cet antécédent"
                className="text-clay hover:underline"
              >
                Supprimer
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
