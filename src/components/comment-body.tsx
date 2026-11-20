"use client";

import { useState, useTransition } from "react";
import { Linkify } from "@/components/linkify";
import { deleteWorkoutCommentAction, updateWorkoutCommentAction } from "@/lib/actions";

// Texte d'un commentaire de séance. Son auteur peut le modifier ou le
// supprimer (petits liens sous le texte) ; les autres le lisent seulement.
export function CommentBody({ id, body, mine, className = "whitespace-pre-line text-ink" }: { id: string; body: string; mine: boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<void>, after?: () => void) =>
    start(async () => {
      setError(null);
      try {
        await fn();
        after?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      }
    });

  if (editing)
    return (
      <div className="flex flex-col gap-1.5">
        <textarea
          autoFocus
          rows={Math.min(8, Math.max(2, draft.split("\n").length))}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full resize-y rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-moss"
        />
        <div className="flex items-center gap-3 text-[12.5px] font-semibold">
          <button type="button" disabled={pending || !draft.trim()} onClick={() => run(() => updateWorkoutCommentAction(id, draft), () => setEditing(false))} className="text-moss-dark disabled:opacity-50">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" onClick={() => { setDraft(body); setEditing(false); }} className="text-slate">Annuler</button>
          {error && <span className="font-normal text-[#a4492a]">{error}</span>}
        </div>
      </div>
    );

  return (
    <div>
      <p className={className}><Linkify text={body} /></p>
      {mine && (
        <div className="mt-0.5 flex items-center gap-3 text-[12px] font-semibold text-slate">
          {confirm ? (
            <>
              <span className="font-normal">Supprimer ce commentaire ?</span>
              <button type="button" disabled={pending} onClick={() => run(() => deleteWorkoutCommentAction(id))} className="text-[#a4492a]">Oui, supprimer</button>
              <button type="button" onClick={() => setConfirm(false)}>Non</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className="hover:text-ink">Modifier</button>
              <button type="button" onClick={() => setConfirm(true)} className="hover:text-[#a4492a]">Supprimer</button>
            </>
          )}
          {error && <span className="font-normal text-[#a4492a]">{error}</span>}
        </div>
      )}
    </div>
  );
}
