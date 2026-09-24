"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CoachNoteEntry } from "@/lib/queries";
import {
  addCoachNoteEntryAction,
  updateCoachNoteEntryAction,
  deleteCoachNoteEntryAction,
} from "@/lib/actions";

/**
 * Zone de saisie dont la hauteur suit le texte : une note d'une ligne n'occupe
 * qu'une ligne, une observation de quinze lignes se lit sans barre de
 * défilement interne. Un champ à hauteur fixe force à écrire court ou à faire
 * défiler dans une fenêtre de trois lignes ; ni l'un ni l'autre ne convient à
 * des notes prises au fil de l'eau.
 */
function AutoTextarea({
  name,
  defaultValue,
  placeholder,
  minRows = 2,
  autoFocus,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  minRows?: number;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function resize(el: HTMLTextAreaElement) {
    // Remise à zéro avant mesure : sans elle, scrollHeight ne redescend jamais
    // quand on efface du texte, et le champ resterait grand pour toujours.
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    if (ref.current) resize(ref.current);
  }, []);

  return (
    <textarea
      ref={ref}
      name={name}
      rows={minRows}
      defaultValue={defaultValue}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onInput={(e) => resize(e.currentTarget)}
      className="w-full resize-none overflow-hidden rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
    />
  );
}

function frLong(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function EntryCard({ entry, onDeleted }: { entry: CoachNoteEntry; onDeleted: (id: string) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const edited = entry.updated_at !== entry.created_at;

  // Sans ce handler, le formulaire restait ouvert après "Enregistrer" — la
  // note semblait ne pas avoir été prise en compte alors qu'elle l'était.
  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("entryId", entry.id);
    await updateCoachNoteEntryAction(formData);
    setPending(false);
    setEditing(false);
    router.refresh();
  }

  // Retrait optimiste (cf. CoachReminders) : la note disparaît dès la
  // confirmation plutôt qu'après l'aller-retour serveur complet.
  async function handleDelete() {
    if (!confirm("Supprimer cette note ?")) return;
    onDeleted(entry.id);
    const formData = new FormData();
    formData.set("entryId", entry.id);
    await deleteCoachNoteEntryAction(formData);
    router.refresh();
  }

  return (
    <li className="rounded-2xl border border-line bg-white px-3 py-2.5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold capitalize text-ink-soft">{frLong(entry.entry_date)}</span>
        {edited && <span className="text-[10px] text-slate">modifiée</span>}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="ml-auto text-xs font-semibold text-slate hover:text-ink"
        >
          {editing ? "Annuler" : "Modifier"}
        </button>
      </div>

      {editing ? (
        <>
          <form onSubmit={handleSave} className="flex flex-col gap-2">
            <AutoTextarea name="body" defaultValue={entry.body} autoFocus />
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                name="entryDate"
                defaultValue={entry.entry_date}
                className="rounded-xl border border-line bg-paper-dim px-2 py-1 text-xs text-ink"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-moss px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="mt-2 text-xs font-semibold text-clay hover:underline"
          >
            Supprimer cette note
          </button>
        </>
      ) : (
        // whitespace-pre-wrap : les retours à la ligne saisis sont conservés,
        // une note prise en liste reste une liste.
        <p className="whitespace-pre-wrap text-sm text-ink">{entry.body}</p>
      )}
    </li>
  );
}

export function CoachJournal({
  athleteId,
  entries,
  today,
}: {
  athleteId: string;
  entries: CoachNoteEntry[];
  today: string;
}) {
  const router = useRouter();
  // Copie locale pour le retrait optimiste (cf. EntryCard.handleDelete) :
  // resynchronisée à chaque rafraîchissement serveur des données réelles.
  const [items, setItems] = useState(entries);
  useEffect(() => setItems(entries), [entries]);
  // Les notes s'empilent vite ; on en montre vingt et le reste sur demande.
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 20);
  const [pending, setPending] = useState(false);
  // Remonter le champ (au lieu d'un simple form.reset()) le vide ET ramène sa
  // hauteur à sa valeur de repos — un reset natif efface le texte mais laisse
  // le textarea agrandi, aucun événement 'input' ne se déclenchant pour le
  // rétrécir.
  const [fieldKey, setFieldKey] = useState(0);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    await addCoachNoteEntryAction(formData);
    setPending(false);
    setFieldKey((k) => k + 1);
    router.refresh();
  }

  return (
    <div>
      <form key={fieldKey} onSubmit={handleAdd} className="mb-4 flex flex-col gap-2">
        <input type="hidden" name="athleteId" value={athleteId} />
        <AutoTextarea
          name="body"
          placeholder="Ce que vous avez observé aujourd'hui…"
          minRows={2}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            name="entryDate"
            defaultValue={today}
            className="rounded-xl border border-line bg-paper-dim px-2 py-1 text-xs text-ink"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-moss px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Ajout…" : "Ajouter la note"}
          </button>
          <span className="text-xs text-slate">Datée du jour, modifiable si vous notez après coup.</span>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-slate">Aucune note pour l&apos;instant.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {visible.map((e) => (
              <EntryCard key={e.id} entry={e} onDeleted={(id) => setItems((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </ul>
          {items.length > visible.length && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-3 text-xs font-semibold text-moss-dark hover:underline"
            >
              Voir les {items.length - visible.length} notes plus anciennes
            </button>
          )}
        </>
      )}
    </div>
  );
}
