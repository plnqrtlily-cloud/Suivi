"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateCalendarTokenAction, revokeCalendarTokenAction } from "@/lib/actions";
import { Button } from "@/components/ui";

// Abonnement du calendrier personnel de l'athlète (Google Agenda, Apple
// Calendrier, Outlook) au flux de ses séances. Export uniquement : l'app ne
// lit pas l'agenda personnel, elle y publie les séances — pas de connexion
// OAuth à installer, et rien de privé n'entre dans l'application.
export function CalendarSyncPanel({ initialToken }: { initialToken: string | null }) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/api/calendar/${token}` : null;

  async function handleGenerate() {
    setPending(true);
    const result = await generateCalendarTokenAction();
    setToken(result.token);
    setPending(false);
    router.refresh();
  }

  async function handleRevoke() {
    if (!confirm("Désactiver l'abonnement ? Le calendrier cessera de se mettre à jour dans votre agenda.")) return;
    setPending(true);
    await revokeCalendarTokenAction();
    setToken(null);
    setPending(false);
    router.refresh();
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!token) {
    return (
      <div>
        <p className="mb-3 text-sm text-slate">
          Retrouvez vos séances directement dans votre agenda habituel. Elles s&apos;y mettent à jour automatiquement
          quand votre coach les modifie.
        </p>
        <Button type="button" onClick={handleGenerate} disabled={pending}>
          {pending ? "Génération…" : "Activer l'abonnement"}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-slate">
        Copiez cette adresse, puis ajoutez-la dans votre agenda (« S&apos;abonner à un calendrier » dans Google
        Agenda, « Nouvel abonnement calendrier » sur Apple).
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-paper-dim px-3 py-2 text-xs text-ink-soft">{url}</code>
        <Button type="button" variant="secondary" onClick={handleCopy}>
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
      <p className="mb-3 text-xs text-slate">
        Gardez cette adresse pour vous : toute personne qui l&apos;a peut voir vos séances. Les agendas se
        rafraîchissent en général toutes les quelques heures — une modification de votre coach peut mettre un moment
        à apparaître.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={handleGenerate} disabled={pending}>
          Régénérer l&apos;adresse
        </Button>
        <Button type="button" variant="ghost" onClick={handleRevoke} disabled={pending}>
          Désactiver
        </Button>
      </div>
    </div>
  );
}
