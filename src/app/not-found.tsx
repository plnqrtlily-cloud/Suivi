import Link from "next/link";

// notFound() est appelé un peu partout (séance inexistante, athlète non lié,
// brouillon consulté par l'athlète) : sans cette page, chacun de ces cas
// affiche l'écran 404 brut de Next.
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 text-center">
        <h1 className="mb-2 font-display text-2xl text-ink">Page introuvable</h1>
        <p className="mb-5 text-sm text-slate">
          Cette page n&apos;existe pas, ou vous n&apos;y avez pas accès.
        </p>
        <Link
          href="/"
          className="inline-block rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss-dark"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
