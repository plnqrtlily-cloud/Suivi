import Link from "next/link";
import { CycleEstimate, PHASE_LABELS } from "@/lib/cycle-types";

// Repère discret du cycle menstruel sur l'accueil, pour les profils qui ont
// renseigné "féminin" (cf. src/app/athlete/profile/cycle-panel.tsx pour le
// détail/la saisie) — visible uniquement si une estimation existe.
export function CycleBadge({ estimate }: { estimate: CycleEstimate }) {
  if (estimate.phase === "inconnue") return null;

  return (
    <Link
      href="/athlete/profile"
      className="inline-flex items-center gap-1.5 rounded-full bg-gold-light/10 px-3 py-1.5 text-[11px] font-bold text-gold-light hover:bg-gold-light/15"
    >
      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2c3 4 5 7 5 10a5 5 0 01-10 0c0-3 2-6 5-10z" />
      </svg>
      {PHASE_LABELS[estimate.phase]}
      {estimate.dayOfCycle ? ` · J${estimate.dayOfCycle}` : ""}
    </Link>
  );
}
