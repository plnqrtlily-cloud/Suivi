"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createInviteAction } from "@/lib/actions";
import { Field, Button } from "@/components/ui";
import { upgradeMailtoHref } from "@/lib/billing";

export function InviteForm() {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    const formData = new FormData(form);
    const result = await createInviteAction(formData);
    setPending(false);
    if ("error" in result) {
      setLimitError(result.error);
      setLink(null); // sinon le lien d'une invitation précédente restait affiché à côté de l'erreur
      return;
    }
    setLimitError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setLink(`${origin}/invite/${result.token}`);
    form.reset();
    router.refresh(); // sans ça, la liste "Invitation en attente" ci-dessous restait périmée
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="w-full sm:flex-1">
          <Field label="Email de l'athlète à inviter (facultatif)" type="email" name="email" placeholder="athlete@exemple.com" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Génération…" : "Générer un lien d'invitation"}
        </Button>
      </form>
      {limitError && (
        <div className="rounded-2xl border border-gold-light/50 bg-gold-light/5 px-3 py-2 text-sm">
          <p className="mb-1 text-ink">{limitError}</p>
          <p className="text-xs text-slate">
            <Link href="/tarifs" className="font-semibold text-moss-dark hover:underline">
              Voir les tarifs
            </Link>{" "}
            ou{" "}
            <a href={upgradeMailtoHref()} className="font-semibold text-moss-dark hover:underline">
              nous contacter directement
            </a>
            .
          </p>
        </div>
      )}
      {link && (
        <div className="rounded-2xl border border-line bg-paper-dim px-3 py-2 text-sm">
          <p className="mb-1">
            Lien à transmettre à l&apos;athlète :{" "}
            <a href={link} className="break-all text-moss-dark underline">
              {link}
            </a>
          </p>
          <p className="text-xs text-slate">
            Si vous testez vous-même : ouvrez ce lien dans une fenêtre de navigation privée ou un
            autre navigateur, pas dans celui où vous êtes déjà connecté·e en tant que coach.
          </p>
        </div>
      )}
    </div>
  );
}
