import Link from "next/link";
import { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-ink-soft font-medium">{label}</span>
      <input
        {...props}
        className="rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-moss focus:ring-1 focus:ring-moss"
      />
    </label>
  );
}

export function TextAreaField({
  label,
  ...props
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-ink-soft font-medium">{label}</span>
      <textarea
        {...props}
        className="rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-moss focus:ring-1 focus:ring-moss"
      />
    </label>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-ink-soft font-medium">{label}</span>
      <select
        {...props}
        className="rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-moss focus:ring-1 focus:ring-moss"
      >
        {children}
      </select>
    </label>
  );
}

// `loading` couvre les petits boutons d'action ghost/icône (retirer, supprimer,
// basculer un statut) qui n'avaient jusqu'ici aucun retour visuel pendant
// l'aller-retour serveur : le clic semblait n'avoir aucun effet pendant
// quelques centaines de ms, ce qui se lit comme de la lenteur plus que le
// temps réel de l'action.
export function Button({
  variant = "primary",
  className = "",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; loading?: boolean }) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";
  const styles = {
    primary: "bg-moss text-white hover:bg-moss-dark",
    secondary: "border border-line bg-white text-ink hover:border-moss",
    ghost: "text-ink-soft hover:text-ink",
  };
  return (
    <button {...props} disabled={disabled || loading} className={`${base} ${styles[variant]} ${className}`}>
      {loading && (
        <svg className="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  children,
}: { href: string; variant?: "primary" | "secondary"; children: React.ReactNode }) {
  const base = "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors";
  const styles = {
    primary: "bg-moss text-white hover:bg-moss-dark",
    secondary: "border border-line bg-white text-ink hover:border-moss",
  };
  return (
    <Link href={href} className={`${base} ${styles[variant]}`}>
      {children}
    </Link>
  );
}

// `rounded-3xl` est de fait le rayon standard de l'app (presque tous les
// appels le répètent dans `className`) — exposé en prop dédiée plutôt que
// laissé au hasard de l'ordre de génération CSS de deux classes `rounded-*`
// concurrentes dans une même chaîne `className`.
export function Card({
  children,
  className = "",
  rounded = "3xl",
}: {
  children: React.ReactNode;
  className?: string;
  rounded?: "lg" | "2xl" | "3xl";
}) {
  const roundedClass = { lg: "rounded-lg", "2xl": "rounded-2xl", "3xl": "rounded-3xl" }[rounded];
  return <div className={`${roundedClass} border border-line bg-white p-5 ${className}`}>{children}</div>;
}

const STATUS_LABELS: Record<string, string> = {
  planned: "Prévue",
  done: "Faite",
  not_done: "Non réalisée",
  partial: "Partielle",
  postponed: "Reportée",
};

// Traitement visuel non punitif du statut (cf. prompt) : "non réalisée" reste
// neutre (gris), jamais un rouge alarmant qui culpabilise l'athlète.
const STATUS_STYLES: Record<string, string> = {
  planned: "bg-moss/10 text-moss-dark",
  done: "bg-moss-dark/10 text-moss-dark",
  not_done: "bg-status-notdone/20 text-slate",
  partial: "bg-status-partial/15 text-status-partial",
  postponed: "bg-status-postponed/15 text-status-postponed",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || "bg-line text-slate"}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

const SPORT_LABELS: Record<string, string> = {
  running: "Course à pied",
  cycling: "Vélo",
  hiking: "Randonnée",
  swimming: "Natation",
  climbing: "Escalade",
  strength: "Musculation",
  other: "Divers",
};

export function sportLabel(sport: string): string {
  return SPORT_LABELS[sport] || sport;
}

export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-sm text-clay">{children}</p>;
}
