"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notePainAction, resolveHealthAction, sendHealthMessageAction } from "@/lib/health-actions";
import { PainScale } from "@/components/pain-scale";
import type { HealthCategory } from "@/lib/health";

export function HealthThreadActions({
  injuryId,
  isAthlete,
  showPain,
  category,
}: {
  injuryId: string;
  isAthlete: boolean;
  showPain: boolean;
  category: HealthCategory;
}) {
  const router = useRouter();
  const [painOpen, setPainOpen] = useState(false);
  const [pain, setPain] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const doneLabel = category === "etat" ? "C'est terminé" : "C'est guéri";

  async function savePain() {
    if (pain == null) return;
    setPending(true);
    await notePainAction(injuryId, pain);
    setPending(false);
    setPainOpen(false);
    setPain(null);
    router.refresh();
  }
  async function resolve() {
    setPending(true);
    await resolveHealthAction(injuryId);
    setPending(false);
    setConfirm(false);
    router.refresh();
  }

  const btn = "flex-1 rounded-xl border border-line bg-white px-3 py-2.5 text-center text-sm font-bold text-moss-dark disabled:opacity-50";
  return (
    <div className="mx-4 mt-2.5 flex flex-col gap-2">
      <div className="flex gap-2">
        {showPain && (
          <button type="button" className={btn} onClick={() => setPainOpen((v) => !v)}>
            Noter ma douleur
          </button>
        )}
        {confirm ? (
          <div className="flex flex-1 gap-2">
            <button type="button" className={`${btn} !bg-moss-dark !text-white`} disabled={pending} onClick={resolve}>
              {pending ? "…" : "Confirmer"}
            </button>
            <button type="button" className={btn} onClick={() => setConfirm(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <button type="button" className={btn} onClick={() => setConfirm(true)}>
            {isAthlete ? doneLabel : category === "etat" ? "Marquer terminé" : "Marquer guéri"}
          </button>
        )}
      </div>
      {painOpen && (
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4">
          <PainScale value={pain} onChange={setPain} />
          <button
            type="button"
            disabled={pain == null || pending}
            onClick={savePain}
            className="rounded-xl bg-moss-dark py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      )}
    </div>
  );
}

const QUICK = ["Ça va mieux", "C'est pareil", "Ça empire"];

export function HealthComposer({ injuryId, isAthlete, placeholder }: { injuryId: string; isAthlete: boolean; placeholder: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: string) {
    if (!body.trim() || pending) return;
    setPending(true);
    setError(null);
    const res = await sendHealthMessageAction(injuryId, body);
    setPending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <div
      className="sticky bottom-16 flex flex-col gap-2 border-t border-paper-dim bg-white px-3 pb-3 pt-2 lg:bottom-0"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      {isAthlete && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              disabled={pending}
              onClick={() => send(q)}
              className="rounded-full border border-line bg-white px-3 py-1 text-[13px] font-semibold text-ink disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          rows={1}
          placeholder={placeholder}
          aria-label={placeholder}
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-[20px] border border-line px-4 py-2 text-[15px] text-ink outline-none focus:border-moss"
        />
        <button
          type="submit"
          disabled={!text.trim() || pending}
          aria-label="Envoyer"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#0a84ff] text-white disabled:opacity-40"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 16V4M5 9l5-5 5 5" />
          </svg>
        </button>
      </form>
      {error && <p className="text-xs text-clay">{error}</p>}
    </div>
  );
}
