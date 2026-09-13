"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendBroadcastMessageAction } from "@/lib/actions";
import { Button, TextAreaField, ErrorText } from "@/components/ui";

export function BroadcastMessageModal({ athleteCount }: { athleteCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") || "");
    setPending(true);
    setError(undefined);
    try {
      await sendBroadcastMessageAction(body);
      setDone(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (athleteCount === 0) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-semibold text-moss-dark hover:underline">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.5 3v-3H5a2 2 0 0 1-2-2z" />
        </svg>
        Message à tous mes athlètes
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-[2px] sm:items-center sm:p-6">
          <button
            aria-label="Fermer"
            className="absolute inset-0 cursor-default"
            onClick={() => {
              setOpen(false);
              setDone(false);
            }}
          />
          <div className="relative z-10 w-full max-w-sm rounded-t-[26px] bg-white p-6 shadow-2xl sm:rounded-[26px]">
            <h2 className="mb-1 font-display text-xl font-semibold text-ink">Message à tous mes athlètes</h2>
            <p className="mb-4 text-[13px] text-slate">
              Envoyé dans le fil de discussion de chacun de vos {athleteCount} athlète{athleteCount > 1 ? "s" : ""} actif
              {athleteCount > 1 ? "s" : ""}, comme un message individuel ordinaire.
            </p>
            {done ? (
              <p className="text-sm text-moss-dark">Message envoyé.</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <TextAreaField label="Message" name="body" rows={4} required placeholder="ex. Séance annulée demain, trop de vent." />
                <ErrorText>{error}</ErrorText>
                <Button type="submit" disabled={pending}>
                  {pending ? "Envoi…" : "Envoyer à tous"}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
