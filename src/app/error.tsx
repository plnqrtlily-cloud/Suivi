"use client";

import { useEffect } from "react";
import Link from "next/link";

// Sans ce fichier, une erreur non rattrapée affiche un écran blanc : l'athlète
// ou le coach ne sait ni ce qui s'est passé, ni comment repartir.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Le détail part dans les journaux serveur ; l'écran reste sobre pour ne
    // pas exposer la structure interne de l'application.
    console.error("Erreur non rattrapée :", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 text-center">
        <h1 className="mb-2 font-display text-2xl text-ink">Quelque chose s&apos;est mal passé</h1>
        <p className="mb-5 text-sm text-slate">
          L&apos;action n&apos;a pas pu aboutir. Vos données sont intactes — réessayez, ou revenez à l&apos;accueil.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-dark"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-moss"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
