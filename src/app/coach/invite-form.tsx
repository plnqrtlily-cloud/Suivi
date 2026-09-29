"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createInviteAction, resendInviteAction, revokeAthleteAccessAction } from "@/lib/actions";
import { upgradeMailtoHref } from "@/lib/billing";

export interface PendingInvite {
  id: string;
  email: string | null;
  firstName: string | null;
  token: string | null;
  sentAt: string | null;
  createdAt: string | null;
}

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-moss focus:bg-white";

function when(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z"));
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          window.prompt("Copiez le lien :", text);
        }
      }}
      className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-moss-dark transition-colors hover:bg-paper-dim"
    >
      {done ? "Copié ✓" : label}
    </button>
  );
}

/**
 * Formulaire d'invitation : prénom, e-mail et un mot facultatif. Si l'envoi
 * d'e-mails est configuré, l'invitation part directement ; sinon (ou sans
 * e-mail) le coach récupère un lien et un message prêts à copier.
 */
export function InviteForm({
  pending = [],
  emailReady = false,
  onDone,
}: {
  pending?: PendingInvite[];
  emailReady?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<{ text: string; limit: boolean } | null>(null);
  const [result, setResult] = useState<{ url: string; emailed: boolean; to: string; name: string } | null>(null);
  const [list, setList] = useState(pending);
  const [source, setSource] = useState(pending);
  if (source !== pending) {
    setSource(pending);
    setList(pending);
  }
  const [flash, setFlash] = useState<Record<string, string>>({});
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await createInviteAction(fd);
      if ("error" in res) {
        setError({ text: res.error, limit: res.error.includes("offre gratuite") || res.error.includes("plan Pro") });
        setResult(null);
        return;
      }
      setError(null);
      setResult({
        url: `${origin}/invite/${res.token}`,
        emailed: res.emailed,
        to: String(fd.get("email") || ""),
        name: String(fd.get("firstName") || ""),
      });
      form.reset();
      router.refresh();
    });
  }

  const shareText = result
    ? `Bonjour${result.name ? ` ${result.name}` : ""}, je t’invite à me rejoindre sur Rythme pour suivre tes entraînements : ${result.url}`
    : "";

  return (
    <div className="flex flex-col gap-5">
      {result ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-paper p-4">
          <p className="text-[15px] font-semibold text-ink">
            {result.emailed
              ? `Invitation envoyée à ${result.to}`
              : result.to
                ? `Invitation prête pour ${result.name || result.to}`
                : "Lien d’invitation prêt"}
          </p>
          <p className="text-sm text-ink-soft">
            {result.emailed
              ? "Elle recevra un e-mail avec le lien. Vous pouvez aussi le lui transmettre directement :"
              : "Transmettez ce lien par message ou par e-mail. Dès qu’il est ouvert, l’athlète crée son compte et rejoint votre suivi."}
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-moss-dark">{result.url}</span>
            <CopyButton text={result.url} label="Copier le lien" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton text={shareText} label="Copier le message" />
            <button type="button" onClick={() => setResult(null)} className="text-xs font-semibold text-moss-dark hover:underline">
              Inviter quelqu’un d’autre
            </button>
            {onDone && (
              <button type="button" onClick={onDone} className="ml-auto text-xs font-semibold text-slate hover:text-ink">
                Terminer
              </button>
            )}
          </div>
          <p className="text-xs text-slate">
            Pour tester vous-même, ouvrez le lien dans une fenêtre de navigation privée : vous êtes connecté·e en coach ici.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate">Prénom</span>
              <input name="firstName" placeholder="Léa" className={field} autoFocus />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate">E-mail (facultatif)</span>
              <input name="email" type="email" placeholder="lea@exemple.com" className={field} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate">Un mot pour l’athlète (facultatif)</span>
            <textarea name="message" rows={2} placeholder="Ravi de t’accompagner cette saison !" className={`${field} resize-none`} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-moss px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-moss-dark disabled:opacity-50"
            >
              {busy ? "Création…" : emailReady ? "Envoyer l’invitation" : "Créer le lien d’invitation"}
            </button>
            <span className="text-xs text-slate">
              {emailReady ? "Sans e-mail, vous obtenez un lien à partager." : "Vous obtiendrez un lien à partager par message ou e-mail."}
            </span>
          </div>
          {error && (
            <div className="rounded-2xl bg-[#fbf1ec] px-3 py-2 text-sm">
              <p className="text-ink">{error.text}</p>
              {error.limit && (
                <p className="mt-1 text-xs text-slate">
                  <Link href="/tarifs" className="font-semibold text-moss-dark hover:underline">
                    Voir les tarifs
                  </Link>{" "}
                  ou{" "}
                  <a href={upgradeMailtoHref()} className="font-semibold text-moss-dark hover:underline">
                    nous contacter
                  </a>
                  .
                </p>
              )}
            </div>
          )}
        </form>
      )}

      {list.length > 0 && (
        <div className="flex flex-col">
          <p className="mb-1 text-sm font-semibold text-ink">
            En attente <span className="font-normal text-slate">· {list.length}</span>
          </p>
          {list.map((p) => {
            const url = p.token ? `${origin}/invite/${p.token}` : "";
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2.5 first-of-type:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{p.firstName || p.email || "Lien partagé"}</p>
                  <p className="truncate text-xs text-slate">
                    {[p.firstName && p.email ? p.email : null, p.sentAt ? `e-mail envoyé ${when(p.sentAt)}` : `créée ${when(p.createdAt)}`]
                      .filter(Boolean)
                      .join(" · ")}
                    {flash[p.id] ? ` · ${flash[p.id]}` : ""}
                  </p>
                </div>
                {url && <CopyButton text={url} label="Copier le lien" />}
                {emailReady && p.email && (
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        const r = await resendInviteAction(p.id);
                        setFlash((f) => ({ ...f, [p.id]: r.emailed ? "renvoyée" : "envoi impossible" }));
                        router.refresh();
                      })
                    }
                    className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-moss-dark hover:bg-paper-dim"
                  >
                    Renvoyer
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Annuler l’invitation"
                  onClick={() => {
                    setList((l) => l.filter((x) => x.id !== p.id));
                    revokeAthleteAccessAction(p.id).then(() => router.refresh());
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none text-slate hover:bg-paper-dim hover:text-clay"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Bouton « Inviter un athlète » qui ouvre le formulaire dans une fenêtre. */
export function InviteButton({ pending, emailReady }: { pending: PendingInvite[]; emailReady: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-moss-dark"
      >
        Inviter un athlète
        {pending.length > 0 && (
          <span className="rounded-full bg-white/20 px-1.5 text-xs" title="Invitations en attente">
            {pending.length}
          </span>
        )}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[10vh] animate-expand-in"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div role="dialog" aria-modal="true" aria-label="Inviter un athlète" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink">Inviter un athlète</h2>
                <p className="text-sm text-slate">Il rejoint votre suivi dès qu’il crée son compte.</p>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-slate hover:bg-paper-dim hover:text-ink"
              >
                ×
              </button>
            </div>
            <InviteForm pending={pending} emailReady={emailReady} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
